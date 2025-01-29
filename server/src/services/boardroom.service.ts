interface Proposal {
  refId: string;
  id: string;
  title: string;
  content: string;
  protocol: string;
  adapter: string;
  proposer: string;
  totalVotes: number;
  blockNumber: number;
  startTime: { blockNumber: number };
  endTime: { blockNumber: number };
  startTimestamp: string;
  endTimestamp: string;
  currentState: string;
  choices: string[];
  results: Array<{ total: number; choice: number }>;
  events: Array<{
    time: { blockNumber: number };
    event: string;
    timestamp: number;
    txHash: string;
  }>;
}

interface ProposalsResponse {
  data: Proposal[];
  nextCursor: string;
}

interface ProposalDetailsResponse {
  data: Proposal;
}

interface DiscussionTopic {
  id: string;
  refId: string;
  protocol: string;
  body: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  topicId: number;
  authorId: number;
  reads: number;
  readersCount: number;
  likeCount: number;
  quoteCount: number;
  replyCount: number;
  replyToPostNumber: number | null;
  postNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionTopicResponse {
  data: DiscussionTopic[];
  nextCursor: string;
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

  public async fetchProposals(
    protocolId: string
  ): Promise<ProposalsResponse[]> {
    return this.makeRequest<ProposalsResponse[]>(
      `/protocols/${protocolId}/proposals`
    );
  }

  public async fetchProposalDetails(
    proposalId: string
  ): Promise<ProposalDetailsResponse> {
    return this.makeRequest<ProposalDetailsResponse>(
      `/proposals/${proposalId}`
    );
  }

  public async fetchDiscourseTopics(
    protocolId: string
  ): Promise<DiscussionTopicResponse> {
    return this.makeRequest<DiscussionTopicResponse>(
      `/discourseTopicPosts?protocol=${protocolId}`,
      true // indicate this endpoint already has query params
    );
  }
}
