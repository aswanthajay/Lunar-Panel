#!/usr/bin/env python3
import json
import os
import re
import subprocess
import time

IMAGES_BASE = "/var/lib/votion/images"
CONTAINERS_BASE = "/var/lib/votion/containers"
VOLUMES_BASE = "/var/lib/pterodactyl/volumes"

os.makedirs(IMAGES_BASE, exist_ok=True)
os.makedirs(CONTAINERS_BASE, exist_ok=True)
os.makedirs("/var/log/votion", exist_ok=True)

def sanitize_name(name):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name)

def ensure_image_exported(image_tag):
    safe_name = sanitize_name(image_tag)
    img_rootfs = os.path.join(IMAGES_BASE, safe_name, "rootfs")
    if os.path.exists(img_rootfs) and os.listdir(img_rootfs):
        return img_rootfs

    print(f"  [+] Exporting base image: {image_tag} -> {safe_name}")
    os.makedirs(img_rootfs, exist_ok=True)
    tmp_container = f"crun_exp_{safe_name[:12]}_{int(time.time())}"
    
    try:
        subprocess.check_call(["docker", "create", "--name", tmp_container, image_tag], stdout=subprocess.DEVNULL)
        export_proc = subprocess.Popen(["docker", "export", tmp_container], stdout=subprocess.PIPE)
        tar_proc = subprocess.Popen(["tar", "-xf", "-", "-C", img_rootfs], stdin=export_proc.stdout)
        export_proc.stdout.close()
        tar_proc.communicate()
        subprocess.call(["docker", "rm", "-f", tmp_container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"  ✓ Base image ready: {safe_name}")
    except Exception as e:
        print(f"  ✗ Failed to export image {image_tag}: {e}")
        subprocess.call(["docker", "rm", "-f", tmp_container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return None

    return img_rootfs

def get_docker_containers():
    out = subprocess.check_output([
        "docker", "ps", "-a", "--format", "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"
    ]).decode().strip()
    
    containers = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) >= 4:
            cid, name, image, status = parts[0], parts[1], parts[2], parts[3]
            if name.endswith("_installer"):
                continue
            is_running = status.startswith("Up")
            containers.append({
                "id": cid,
                "name": name,
                "image": image,
                "is_running": is_running
            })
    return containers

def convert_container(c):
    uuid = c["name"]
    server_vol = os.path.join(VOLUMES_BASE, uuid)
    bundle_dir = os.path.join(CONTAINERS_BASE, uuid)

    # 1. Ensure rootfs is available
    rootfs_dir = ensure_image_exported(c["image"])
    if not rootfs_dir:
        print(f"  [!] Skipping {uuid}: rootfs export failed.")
        return False

    # 2. Inspect container config
    try:
        raw_inspect = subprocess.check_output(["docker", "inspect", uuid]).decode()
        data = json.loads(raw_inspect)[0]
    except Exception as e:
        print(f"  [!] Failed to inspect {uuid}: {e}")
        return False

    config_json_path = os.path.join(bundle_dir, "config.json")
    os.makedirs(bundle_dir, exist_ok=True)

    # 3. Generate crun spec if not already generated
    os.chdir(bundle_dir)
    subprocess.call(["crun", "spec"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with open(config_json_path, "r") as f:
        spec = json.load(f)

    env = data.get("Config", {}).get("Env", [])
    cmd = data.get("Config", {}).get("Cmd") or ["/bin/bash", "/entrypoint.sh"]

    spec["root"]["path"] = rootfs_dir
    spec["root"]["readonly"] = True
    spec["process"]["user"]["uid"] = 999
    spec["process"]["user"]["gid"] = 995
    spec["process"]["cwd"] = "/home/container"
    spec["process"]["args"] = cmd
    spec["process"]["env"] = env
    spec["process"]["terminal"] = False

    # Clean existing destination mounts
    spec["mounts"] = [
        m for m in spec["mounts"] 
        if m["destination"] not in ["/home/container", "/etc/resolv.conf", "/etc/hosts"]
    ]

    # Mount persistent server volume
    spec["mounts"].append({
        "destination": "/home/container",
        "type": "bind",
        "source": server_vol,
        "options": ["rbind", "rprivate", "rw"]
    })
    spec["mounts"].append({
        "destination": "/etc/resolv.conf",
        "type": "bind",
        "source": "/etc/resolv.conf",
        "options": ["rbind", "ro"]
    })
    spec["mounts"].append({
        "destination": "/etc/hosts",
        "type": "bind",
        "source": "/etc/hosts",
        "options": ["rbind", "ro"]
    })

    # Share host network for zero NAT latency
    spec["linux"]["namespaces"] = [
        ns for ns in spec["linux"]["namespaces"] if ns["type"] != "network"
    ]

    with open(config_json_path, "w") as f:
        json.dump(spec, f, indent=2)

    return True

def main():
    print("==================================================")
    print("  VOTION 2.0 ZERO-COPY CRUN OCI CONVERTER")
    print("==================================================")
    
    containers = get_docker_containers()
    print(f"[+] Discovered {len(containers)} server containers.")

    converted_count = 0
    running_to_switch = []

    for idx, c in enumerate(containers, 1):
        print(f"\n[{idx}/{len(containers)}] Processing {c['name']} ({c['image']})...")
        if convert_container(c):
            converted_count += 1
            if c["is_running"]:
                running_to_switch.append(c["name"])

    print("\n==================================================")
    print(f"[✓] Converted {converted_count}/{len(containers)} containers to crun OCI bundles.")
    print(f"[+] Switching {len(running_to_switch)} running containers to crun...")
    print("==================================================")

    # Seamless switch
    for uuid in running_to_switch:
        print(f"  -> Switching {uuid} to crun...")
        subprocess.call(["docker", "stop", uuid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        bundle = os.path.join(CONTAINERS_BASE, uuid)
        env = os.environ.copy()
        env["XDG_RUNTIME_DIR"] = "/run/user/0"
        res = subprocess.call(["crun", "run", "-d", "-b", bundle, uuid], env=env)
        if res == 0:
            print(f"  ✓ {uuid} is now live on crun!")
        else:
            print(f"  ✗ Failed to start {uuid} on crun, fallback to docker...")
            subprocess.call(["docker", "start", uuid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print("\n[✓] MIGRATION TO DOCKER-LESS CRUN COMPLETE!")

if __name__ == "__main__":
    main()
