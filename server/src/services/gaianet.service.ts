import { BaseService } from "./base.service.js";
import { AgentRuntime, Service, ServiceType } from "@ai16z/eliza";

interface TextResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GaiaNetResponse {
  choices: Array<{ text: string }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GaianetService extends BaseService implements Service {
  private static instance: GaianetService;
  private serverUrl: string;

  // Use the correct ServiceType enum value
  public readonly serviceType = ServiceType.TEXT_GENERATION;

  private constructor() {
    super();

    if (!process.env.GAIANET_SERVER_URL) {
      throw new Error("GAIANET_SERVER_URL is required");
    }

    this.serverUrl = process.env.GAIANET_SERVER_URL;
  }

  public static getInstance(): GaianetService {
    if (!GaianetService.instance) {
      GaianetService.instance = new GaianetService();
    }
    return GaianetService.instance;
  }

  // Required by Service interface
  public async initialize(): Promise<void> {
    await this.testConnection();
  }

  // Clean response text from metadata and instructions
  private cleanResponse(text: string): string {
    // Remove common instruction patterns
    text = text.replace(/\(.*?\)/g, ""); // Remove parenthetical instructions
    text = text.replace(/Please keep responses in character.*$/gm, "");
    text = text.replace(/Feel free to.*$/gm, "");
    text = text.replace(/You may start with.*$/gm, "");
    text = text.replace(/<\|eot_id\|>/g, "");

    // Trim whitespace and empty lines
    text = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .join("\n");

    return text;
  }

  // Text generation method
  public async generateText(prompt: string): Promise<TextResponse> {
    try {
      const response = await fetch(`${this.serverUrl}/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GAIANET_MODEL,
          prompt,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GAIANET API error: ${error}`);
      }

      const rawData = await response.json();
      const data = rawData as GaiaNetResponse;

      if (!data?.choices?.[0]?.text) {
        throw new Error("Invalid response format from GAIANET");
      }

      const cleanedText = this.cleanResponse(data.choices[0].text);

      return {
        text: cleanedText,
        usage: data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error) {
      console.error("Error generating text:", error);
      throw error;
    }
  }

  public async testConnection(): Promise<void> {
    try {
      console.log("Testing GAIANET connection...");

      const testUrl = `${this.serverUrl}/completions`;
      console.log("GAIANET config:", {
        serverUrl: testUrl,
      });

      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GAIANET_MODEL,
          prompt: "Hello, world!",
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GAIANET test failed: ${error}`);
      }

      const rawData = await response.json();
      const data = rawData as GaiaNetResponse;
      console.log("GAIANET test successful:", data);
    } catch (error) {
      console.error("GAIANET test failed:", error);
      throw error;
    }
  }

  // Register this service with Eliza's runtime
  public registerWithEliza(runtime: AgentRuntime): void {
    console.log("Registering GAIANET service");
    runtime.registerService(this);
  }

  // Implement BaseService abstract methods
  public async start(): Promise<void> {
    console.log("Starting GAIANET service with:", {
      serverUrl: this.serverUrl,
    });

    // Initialize the service
    await this.initialize();

    console.log("GAIANET service started successfully");
  }

  public async stop(): Promise<void> {
    // No cleanup needed
    console.log("GAIANET service stopped");
  }
}
