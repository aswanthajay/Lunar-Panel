import { describe, it, expect } from "vitest";
import { EggParser, PterodactylEgg } from "./egg-parser";
import fs from "node:fs";
import path from "node:path";

describe("EggParser", () => {
  const sampleEgg: PterodactylEgg = {
    meta: { version: "PTDL_v2" },
    name: "Test Minecraft Paper",
    author: "test@votion.app",
    docker_images: {
      "Java 17": "ghcr.io/pterodactyl/yolks:java_17",
      "Java 21": "ghcr.io/pterodactyl/yolks:java_21",
    },
    startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
    config: {
      stop: "stop",
    },
    variables: [
      {
        name: "Jar File",
        description: "The primary jar executable",
        env_variable: "SERVER_JARFILE",
        default_value: "server.jar",
        user_viewable: true,
        user_editable: true,
        rules: "required|string",
      },
    ],
  };

  it("should successfully parse valid egg JSON", () => {
    const parsed = EggParser.parse(JSON.stringify(sampleEgg));
    expect(parsed.name).toBe("Test Minecraft Paper");
    expect(parsed.docker_images["Java 21"]).toBe("ghcr.io/pterodactyl/yolks:java_21");
  });

  it("should correctly interpolate variables in startup commands", () => {
    const template = "java -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}} --port {{SERVER_PORT}}";
    const interpolated = EggParser.interpolateVariables(template, {
      SERVER_MEMORY: 4096,
      SERVER_JARFILE: "paper.jar",
      SERVER_PORT: 25565,
    });

    expect(interpolated).toBe("java -Xmx4096M -jar paper.jar --port 25565");
  });

  it("should compile egg into runtime configuration with stop command and env", () => {
    const compiled = EggParser.compile(sampleEgg, {
      selectedImageKey: "Java 21",
      userVariables: {
        SERVER_JARFILE: "custom-paper.jar",
      },
      systemVariables: {
        serverMemoryMb: 4096,
        serverPort: 25565,
      },
    });

    expect(compiled.startupCommand).toBe("java -Xms128M -Xmx4096M -jar custom-paper.jar");
    expect(compiled.dockerImage).toBe("ghcr.io/pterodactyl/yolks:java_21");
    expect(compiled.stopCommand).toBe("stop");
    expect(compiled.environment["SERVER_MEMORY"]).toBe("4096");
    expect(compiled.environment["SERVER_PORT"]).toBe("25565");
    expect(compiled.environment["SERVER_JARFILE"]).toBe("custom-paper.jar");
  });

  it("should parse the repository egg-votion-code.json successfully", () => {
    const eggPath = path.resolve(process.cwd(), "../../egg-votion-code.json");
    if (fs.existsSync(eggPath)) {
      const raw = fs.readFileSync(eggPath, "utf-8");
      const egg = EggParser.parse(raw);
      expect(egg.name).toContain("Votion Code");
      const compiled = EggParser.compile(egg, {
        systemVariables: {
          serverMemoryMb: 2048,
          serverPort: 8080,
        },
      });
      expect(compiled.startupCommand).toContain("0.0.0.0:8080");
      expect(compiled.stopSignal).toBe("SIGINT");
    }
  });
});
