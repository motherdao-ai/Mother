import { BaseService } from "./base.service.js";
import {
  AgentRuntime,
  Character,
  defaultCharacter,
  elizaLogger,
  MemoryManager,
  Memory,
  CacheManager,
  MemoryCacheAdapter,
  UUID,
  composeContext,
  ModelProviderName,
} from "@ai16z/eliza";

elizaLogger.closeByNewLine = false;
elizaLogger.verbose = false;

import { SqliteDatabaseAdapter } from "@ai16z/adapter-sqlite";
import Database from "better-sqlite3";
import path from "path";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import { GaianetService } from "./gaianet.service.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { collablandPlugin } from "../plugins/collabland.plugin.js";

const MAX_MESSAGE_LENGTH = 4096;

// Platform-agnostic interface for message handling
export interface IPlatformAdapter {
  reply(text: string): Promise<void>;
}

export class ElizaService extends BaseService {
  private static instance: ElizaService | null = null;
  private runtime: AgentRuntime;
  private gaianetService: GaianetService;

  private constructor() {
    super();

    // Initialize GAIANET service first
    this.gaianetService = GaianetService.getInstance();

    // Load character from json file
    let character: Character;

    if (!process.env.ELIZA_CHARACTER_PATH) {
      console.log("No ELIZA_CHARACTER_PATH defined, using default character");
      character = defaultCharacter;
    } else {
      try {
        // Use absolute path from project root
        const fullPath = resolve(
          __dirname,
          "../../..",
          process.env.ELIZA_CHARACTER_PATH
        );
        console.log(`Loading character from: ${fullPath}`);

        if (!existsSync(fullPath)) {
          throw new Error(`Character file not found at ${fullPath}`);
        }

        const fileContent = readFileSync(fullPath, "utf-8");
        character = JSON.parse(fileContent);
        console.log("Successfully loaded custom character:", character.name);
      } catch (error) {
        console.error(
          `Failed to load character from ${process.env.ELIZA_CHARACTER_PATH}:`,
          error
        );
        console.log("Falling back to default character");
        character = defaultCharacter;
      }
    }

    const sqlitePath = path.join(__dirname, "..", "..", "..", "eliza.sqlite");
    console.log("Using SQLite database at:", sqlitePath);
    // Initialize SQLite adapter
    const db = new SqliteDatabaseAdapter(new Database(sqlitePath));

    db.init()
      .then(() => {
        console.log("Database initialized.");
      })
      .catch((error) => {
        console.error("Failed to initialize database:", error);
        throw error;
      });

    try {
      // Create runtime first
      this.runtime = new AgentRuntime({
        databaseAdapter: db,
        character,
        conversationLength: 4096,
        plugins: [bootstrapPlugin, collablandPlugin],
        cacheManager: new CacheManager(new MemoryCacheAdapter()),
        logging: false,
        token: process.env.GAIANET_API_KEY || "", // Required by AgentRuntime
        serverUrl: process.env.GAIANET_SERVER_URL, // Optional but good to provide
        modelProvider: "gaianet" as ModelProviderName, // Required by AgentRuntime
      });

      // Register GAIANET service immediately after runtime creation
      this.gaianetService.registerWithEliza(this.runtime);
      console.log("Registered GAIANET service with Eliza runtime");

      // Create memory manager
      const onChainMemory = new MemoryManager({
        tableName: "onchain",
        runtime: this.runtime,
      });
      this.runtime.registerMemoryManager(onChainMemory);
    } catch (error) {
      console.error("Failed to initialize Eliza runtime:", error);
      throw error;
    }
  }

  public static getInstance(): ElizaService {
    if (!ElizaService.instance) {
      ElizaService.instance = new ElizaService();
    }
    return ElizaService.instance;
  }

  // Process a message and generate a response using the platform-specific adapter
  public async processMessage(
    message: string,
    adapter: IPlatformAdapter
  ): Promise<void> {
    try {
      // Create a memory object for this message
      const memory: Memory = {
        content: {
          text: message,
        },
        createdAt: Date.now(),
        userId: uuidv4() as UUID,
        agentId: this.runtime.agentId,
        roomId: uuidv4() as UUID,
      };

      // Get default template if none is specified
      let template =
        this.runtime.character.templates?.messageHandlerTemplate || "";

      // Fallback template if none is provided
      if (!template) {
        template =
          "You are {{agentName}}. Current message: {{currentPost}}. Respond:";
      }

      // Generate context for this message
      const context = await composeContext({
        state: {
          userId: memory.userId,
          agentId: memory.agentId,
          roomId: memory.roomId,
          bio:
            this.runtime.character.bio instanceof Array
              ? this.runtime.character.bio.join("\n")
              : this.runtime.character.bio,
          lore: this.runtime.character.lore.join("\n"),
          messageDirections: "",
          postDirections: "",
          actors: "",
          agentName: this.runtime.character.name,
          recentMessages: message,
          recentMessagesData: [memory],
          formattedConversation: "",
          currentPost: message,
          goals: "",
          goalsData: [],
          knowledge: "",
          knowledgeData: [],
        },
        template,
      });
      console.log("Generated context:", context);

      // Generate response using the composed context
      const response = await this.gaianetService.generateText(context);
      console.log("Generated response:", response);

      // Split response if it's too long
      const chunks = this.splitMessage(response.text);

      // Send each chunk through the platform adapter
      for (const chunk of chunks) {
        await adapter.reply(chunk);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      await adapter.reply(
        "Sorry, I encountered an error while processing your message."
      );
    }
  }

  // Split long messages into smaller chunks
  private splitMessage(text: string): string[] {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = "";
    const words = text.split(" ");

    for (const word of words) {
      if ((currentChunk + " " + word).length > MAX_MESSAGE_LENGTH) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? " " : "") + word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  public async start(): Promise<void> {
    try {
      console.log("ElizaService started successfully");
    } catch (error) {
      console.error("Failed to start ElizaService:", error);
      throw error;
    }
  }

  public getRuntime(): AgentRuntime {
    return this.runtime;
  }

  public async stop(): Promise<void> {
    try {
      console.log("Eliza service stopped");
    } catch (error) {
      console.error("Error stopping Eliza service:", error);
    }
  }
}
