/**
 * Votion Platform - Pterodactyl Egg Loader & Compiler
 * 
 * Ingests official Pterodactyl Egg format (JSON), validates specifications,
 * substitutes system and user variables, and compiles into OCI-compliant runtime configurations.
 */

export interface EggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
  field_type?: string;
}

export interface EggScript {
  script: string;
  container: string;
  entrypoint: string;
}

export interface EggConfig {
  files?: string | Record<string, unknown>;
  startup?: string | { done?: string; userInteraction?: string[] };
  logs?: string | Record<string, unknown>;
  stop?: string;
}

export interface PterodactylEgg {
  _comment?: string;
  meta: {
    version: string;
    update_url?: string | null;
  };
  exported_at?: string;
  name: string;
  author: string;
  description?: string;
  features?: string[];
  docker_images: Record<string, string>;
  file_denylist?: string[];
  startup: string;
  config: EggConfig;
  scripts?: {
    installation?: EggScript;
  };
  variables: EggVariable[];
}

export interface CompiledEggRuntime {
  startupCommand: string;
  dockerImage: string;
  environment: Record<string, string>;
  stopSignal: string;
  stopCommand?: string;
  installationScript?: {
    script: string;
    container: string;
    entrypoint: string;
  };
}

export class EggParser {
  /**
   * Parse and validate raw JSON string or object into a PterodactylEgg instance
   */
  public static parse(content: string | Record<string, unknown>): PterodactylEgg {
    const raw = typeof content === "string" ? JSON.parse(content) : content;

    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid Egg: Expected an object");
    }

    if (!raw.name || typeof raw.name !== "string") {
      throw new Error("Invalid Egg: Missing 'name' field");
    }

    if (!raw.startup || typeof raw.startup !== "string") {
      throw new Error("Invalid Egg: Missing 'startup' command template");
    }

    if (!raw.docker_images || typeof raw.docker_images !== "object") {
      throw new Error("Invalid Egg: Missing or invalid 'docker_images' mapping");
    }

    const egg: PterodactylEgg = {
      meta: raw.meta || { version: "PTDL_v2" },
      name: raw.name,
      author: raw.author || "Unknown",
      description: raw.description || "",
      features: Array.isArray(raw.features) ? raw.features : [],
      docker_images: raw.docker_images,
      file_denylist: Array.isArray(raw.file_denylist) ? raw.file_denylist : [],
      startup: raw.startup,
      config: raw.config || {},
      scripts: raw.scripts,
      variables: Array.isArray(raw.variables) ? raw.variables : [],
    };

    return egg;
  }

  /**
   * Substitutes all {{VARIABLE}} tokens in a template string using provided dictionary
   */
  public static interpolateVariables(
    template: string,
    variables: Record<string, string | number>
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      if (key in variables) {
        return String(variables[key]);
      }
      return match;
    });
  }

  /**
   * Compiles egg variables, user inputs, and system environment into final runtime configuration
   */
  public static compile(
    egg: PterodactylEgg,
    options: {
      selectedImageKey?: string;
      customImage?: string;
      userVariables?: Record<string, string>;
      systemVariables: {
        serverMemoryMb: number;
        serverPort: number;
        serverIp?: string;
        timezone?: string;
      };
    }
  ): CompiledEggRuntime {
    const finalEnv: Record<string, string> = {};

    // 1. Populate default values from egg variable declarations
    for (const v of egg.variables) {
      finalEnv[v.env_variable] = v.default_value ?? "";
    }

    // 2. Override with user-provided variable values
    if (options.userVariables) {
      for (const [k, v] of Object.entries(options.userVariables)) {
        finalEnv[k] = v;
      }
    }

    // 3. Inject Pterodactyl-standard system variables
    finalEnv["SERVER_MEMORY"] = String(options.systemVariables.serverMemoryMb);
    finalEnv["SERVER_PORT"] = String(options.systemVariables.serverPort);
    finalEnv["SERVER_IP"] = options.systemVariables.serverIp || "0.0.0.0";
    finalEnv["TZ"] = options.systemVariables.timezone || "UTC";

    // 4. Resolve Docker Image
    let dockerImage = "";
    if (options.customImage) {
      dockerImage = options.customImage;
    } else if (
      options.selectedImageKey &&
      egg.docker_images[options.selectedImageKey]
    ) {
      dockerImage = egg.docker_images[options.selectedImageKey];
    } else {
      const firstKey = Object.keys(egg.docker_images)[0];
      dockerImage = firstKey ? egg.docker_images[firstKey] : "ubuntu:22.04";
    }

    // 5. Interpolate startup command template
    const startupCommand = this.interpolateVariables(egg.startup, finalEnv);

    // 6. Parse stop signal or command
    let stopSignal = "SIGTERM";
    let stopCommand: string | undefined = undefined;

    const stopConfig = egg.config?.stop;
    if (stopConfig) {
      if (stopConfig === "^C") {
        stopSignal = "SIGINT";
      } else if (stopConfig.startsWith("^")) {
        stopSignal = "SIGTERM";
      } else {
        // Stop is a command sent to process stdin (e.g. "stop", "quit", "exit")
        stopCommand = stopConfig;
      }
    }

    // 7. Extract installation script if present
    let installationScript = undefined;
    if (egg.scripts?.installation?.script) {
      installationScript = {
        script: egg.scripts.installation.script,
        container: egg.scripts.installation.container || "ghcr.io/pterodactyl/installers:alpine",
        entrypoint: egg.scripts.installation.entrypoint || "ash",
      };
    }

    return {
      startupCommand,
      dockerImage,
      environment: finalEnv,
      stopSignal,
      stopCommand,
      installationScript,
    };
  }
}
