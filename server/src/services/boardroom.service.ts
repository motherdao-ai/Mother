import fetch from "node-fetch";

interface Proposal {
  id: string;
  title: string;
  content: string;
  // ...add other proposal properties as needed
}

interface DiscussionTopic {
  id: string;
  title: string;
  // ...add other discussion topic properties as needed
}

export default class BoardroomService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.BOARDROOM_API_URL || "https://api.boardroom.info/v1";
    this.apiKey = process.env.BOARDROOM_API_KEY || "";
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.apiUrl}/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Boardroom API error: ${response.statusText}`);
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  public async fetchProposals(protocolId: string): Promise<Proposal[]> {
    return this.makeRequest<Proposal[]>(`protocols/${protocolId}/proposals`);
  }

  public async fetchProposalDetails(
    protocolId: string,
    proposalId: string
  ): Promise<Proposal> {
    return this.makeRequest<Proposal>(
      `protocols/${protocolId}/proposals/${proposalId}`
    );
  }

  public async fetchDiscourseTopics(
    protocolId: string
  ): Promise<DiscussionTopic[]> {
    return this.makeRequest<DiscussionTopic[]>(
      `discussions/${protocolId}/topics`
    );
  }
}
