import { BaseService } from "./base.service.js";
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  Interaction,
  Message,
  TextChannel,
  DMChannel,
  NewsChannel,
} from "discord.js";
import { ElizaService } from "./eliza.service.js";

export class DiscordService extends BaseService {
  private static instance: DiscordService;
  private client: Client;
  private elizaService: ElizaService;
  private rest: REST;

  private constructor() {
    super();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, // Required for basic guild (server) information
        GatewayIntentBits.GuildMessages, // Required for receiving messages
        GatewayIntentBits.MessageContent, // Required for reading message content
        GatewayIntentBits.GuildMembers, // Required for member information
        GatewayIntentBits.GuildPresences, // Required for member presence
      ],
    });

    // Create REST API instance for registering commands
    this.rest = new REST({ version: "10" });

    // Initialize ElizaService
    this.elizaService = ElizaService.getInstance();

    // Set up event handlers
    this.setupEventHandlers();
  }

  public static getInstance(): DiscordService {
    if (!DiscordService.instance) {
      DiscordService.instance = new DiscordService();
    }
    return DiscordService.instance;
  }

  private async registerCommands(): Promise<void> {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_BOT_TOKEN) {
      throw new Error("DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN are required");
    }

    try {
      console.log("Started refreshing application (/) commands.");

      await this.rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        {
          body: [
            {
              name: "mother",
              description: "Talk to Mother",
              options: [
                {
                  name: "message",
                  description: "Your message to Mother",
                  type: 3, // STRING type
                  required: true,
                },
              ],
            },
          ],
        }
      );

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error("Error registering Discord commands:", error);
    }
  }

  private async testGaianetConnection(): Promise<void> {
    try {
      console.log("Testing GAIANET connection from Discord service...");

      // Get GAIANET configuration
      const serverUrl = process.env.GAIANET_SERVER_URL;
      const model = process.env.GAIANET_MODEL;

      if (!serverUrl || !model) {
        throw new Error("GAIANET_SERVER_URL and GAIANET_MODEL are required");
      }

      const completionsUrl = `${serverUrl}/completions`;
      console.log("GAIANET config:", {
        serverUrl: completionsUrl,
        model,
      });

      const response = await fetch(completionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: "Hello, world!",
          max_tokens: 50,
        }),
      });

      console.log(
        "GAIANET test response status from Discord:",
        response.status
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GAIANET test from Discord failed: ${error}`);
      }

      const data = await response.json();
      console.log("GAIANET test from Discord successful:", data);
    } catch (error) {
      console.error("GAIANET connection test from Discord failed:", error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle ready event
    this.client.once(Events.ClientReady, () => {
      console.log("Discord bot is ready!");
    });

    // Handle messages
    this.client.on(Events.MessageCreate, async (message: Message) => {
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if the bot was mentioned
      if (message.mentions.has(this.client.user!)) {
        try {
          // Remove the mention and clean up the message
          const cleanMessage = message.content
            .replace(new RegExp(`<@!?${this.client.user!.id}>`), "")
            .trim();

          console.log("Clean message:", cleanMessage);

          // Create a message adapter that matches the IPlatformAdapter interface
          const adapter = {
            reply: async (text: string) => {
              try {
                await message.reply({
                  content: text,
                  allowedMentions: { parse: [] },
                });
              } catch (error) {
                console.error("Error sending Discord reply:", error);
                // Try to send a new message if reply fails
                if (
                  message.channel instanceof TextChannel ||
                  message.channel instanceof DMChannel ||
                  message.channel instanceof NewsChannel
                ) {
                  await message.channel.send({
                    content: text,
                    allowedMentions: { parse: [] },
                  });
                }
              }
            },
          };

          // Process the message through ElizaService
          await this.elizaService.processMessage(cleanMessage, adapter);
        } catch (error) {
          console.error("Error handling Discord message:", error);
          await message.reply({
            content:
              "Sorry, I encountered an error while processing your message.",
            allowedMentions: { parse: [] },
          });
        }
      }
    });

    // Handle slash command interactions
    this.client.on(
      Events.InteractionCreate,
      async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        try {
          if (interaction.commandName === "mother") {
            // Defer the reply to avoid timeout
            await interaction.deferReply();

            const message = interaction.options.getString("message", true);

            // Create an adapter that matches the IPlatformAdapter interface
            const adapter = {
              reply: async (text: string) => {
                try {
                  if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                      content: text,
                      allowedMentions: { parse: [] },
                    });
                  } else {
                    await interaction.reply({
                      content: text,
                      allowedMentions: { parse: [] },
                    });
                  }
                } catch (error) {
                  console.error(
                    "Error sending Discord interaction reply:",
                    error
                  );
                  // Try to send a new message if reply fails
                  const channel = interaction.channel;
                  if (
                    channel instanceof TextChannel ||
                    channel instanceof DMChannel ||
                    channel instanceof NewsChannel
                  ) {
                    await channel.send({
                      content: text,
                      allowedMentions: { parse: [] },
                    });
                  }
                }
              },
            };

            // Process the message through ElizaService
            await this.elizaService.processMessage(message, adapter);
          }
        } catch (error) {
          console.error("Error handling Discord interaction:", error);
          const errorMessage =
            "Sorry, I encountered an error while processing your message.";

          try {
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({
                content: errorMessage,
                ephemeral: true,
              });
            } else {
              await interaction.reply({
                content: errorMessage,
                ephemeral: true,
              });
            }
          } catch (replyError) {
            console.error("Error sending error message:", replyError);
          }
        }
      }
    );

    // Handle errors
    this.client.on(Events.Error, (error: Error) => {
      console.error("Discord client error:", error);
    });
  }

  public async start(): Promise<void> {
    try {
      if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error("DISCORD_BOT_TOKEN is required");
      }

      // Test GAIANET connection first
      console.log(
        "Testing GAIANET connection before starting Discord service..."
      );
      await this.testGaianetConnection();

      // Set up Discord token
      this.rest.setToken(process.env.DISCORD_BOT_TOKEN);

      // Register commands
      await this.registerCommands();

      // Login to Discord
      await this.client.login(process.env.DISCORD_BOT_TOKEN);

      console.log("Discord service started successfully");
    } catch (error) {
      console.error("Failed to start Discord service:", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.client.destroy();
    } catch (error) {
      console.error("Error stopping Discord bot:", error);
    }
  }
}
