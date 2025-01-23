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

  private async makeRequest<T>(
    endpoint: string,
    hasParams: boolean = false
  ): Promise<T> {
    const separator = hasParams ? "&" : "?";
    const response = await fetch(
      `${this.apiUrl}/${endpoint}${separator}key=${this.apiKey}`
    );
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
    return this.makeRequest<Proposal[]>(`/protocols/${protocolId}/proposals`);
  }

  public async fetchProposalDetails(proposalId: string): Promise<Proposal> {
    return this.makeRequest<Proposal>(`/proposals/${proposalId}`);
  }

  public async fetchDiscourseTopics(
    protocolId: string
  ): Promise<DiscussionTopic[]> {
    return this.makeRequest<DiscussionTopic[]>(
      `/discourseTopicPosts?protocol=${protocolId}`,
      true // indicate this endpoint already has query params
    );
  }
}
