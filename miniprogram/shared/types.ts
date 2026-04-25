export type TemplateId = "template-49" | "template-53" | "template-57";
export type TripStatus = "active" | "dissolved";
export type MemberRole = "admin" | "member";
export type SeatProfileMode = "wechat" | "custom";
export type ToolType = "seat-draw" | "vote" | "wheel" | "lottery";
export type VoteChoice = "approve" | "reject" | "abstain";
export type VoteSelectionMode = "single" | "multiple";
export type SeatDrawPhase = "ready" | "rolling" | "result";
export type VotePhase = "draft" | "active" | "ended";
export type WheelPhase = "draft" | "result";
export type LotteryPhase = "ready" | "active";

export interface User {
  id: string;
  nickname: string;
  avatarUrl: string;
  homePersonaAssetId: string | null;
  bio: string;
  livingCity: string;
  hometown: string;
  age: string;
  tags: string[];
  currentTripId: string | null;
  isAuthorized: boolean;
}

export interface HomePersonaOption {
  id: string;
  imageUrl: string;
}

export interface LocationDisplay {
  primary: string;
  secondary: string;
  full: string;
  isPlaceholder: boolean;
}

export interface PublishedToolBaseState {
  type: ToolType;
  publishedAt: number;
  publishedByUserId: string;
}

export interface ToolMemberSnapshot {
  userId: string;
  seatCode: string | null;
}

export interface PublishedSeatDrawToolState extends PublishedToolBaseState {
  type: "seat-draw";
  phase: SeatDrawPhase;
  topic: string;
  config: {
    drawCount: number;
    excludePreviouslyDrawn: boolean;
    excludeAdmin: boolean;
  };
  rollingDisplayEntries: ToolMemberSnapshot[];
  pendingResult: ToolMemberSnapshot[];
  drawnEntries: ToolMemberSnapshot[];
  resultRounds: ToolMemberSnapshot[][];
  rollingStartedAt: number | null;
  rollingEndsAt: number | null;
  lastResult: ToolMemberSnapshot[];
}

export interface PublishedVoteToolState extends PublishedToolBaseState {
  type: "vote";
  phase: VotePhase;
  topic: string;
  excludeAdmin: boolean;
  selectionMode: VoteSelectionMode;
  maxSelections: number;
  options: VoteOption[];
  participantUserIds: string[];
  submissions: Record<string, VoteSubmission>;
}

export interface PublishedWheelToolState extends PublishedToolBaseState {
  type: "wheel";
  phase: WheelPhase;
  topic: string;
  items: string[];
  allowAssignedUser: boolean;
  assignedUserId: string | null;
  resultIndex: number | null;
  resultHistoryLabels: string[];
  spunAt: number | null;
}

export interface LotteryCard {
  id: string;
  order: number;
  answer: string;
  claimedByUserId: string | null;
  claimedAt: number | null;
}

export interface LotteryClaimRecord {
  cardId: string;
  order: number;
  answer: string;
  claimedAt: number;
}

export interface PublishedLotteryToolState extends PublishedToolBaseState {
  type: "lottery";
  phase: LotteryPhase;
  topic: string;
  answers: string[];
  cards: LotteryCard[];
  allowAssignedUser: boolean;
  assignedUserId: string | null;
  drawLimitPerUser: number;
  claimsByUserId: Record<string, LotteryClaimRecord[]>;
}

export type PublishedToolState =
  | PublishedSeatDrawToolState
  | PublishedVoteToolState
  | PublishedWheelToolState
  | PublishedLotteryToolState;

export type TripToolsState = Record<ToolType, PublishedToolState | null>;

export interface VoteOption {
  id: string;
  label: string;
}

export interface VoteSubmission {
  choice: VoteChoice;
  optionIds: string[];
  submittedAt: number;
}

export interface Trip {
  id: string;
  tripName: string;
  departureTime: string;
  password: string;
  templateId: TemplateId;
  creatorUserId: string;
  status: TripStatus;
  seatCodes: string[];
  seatMap: Record<string, string | null>;
  tools: TripToolsState;
  createdAt: number;
}

export interface TripMember {
  tripId: string;
  userId: string;
  role: MemberRole;
  joinedAt: number;
}

export interface TripFavoriteRelation {
  tripId: string;
  sourceUserId: string;
  targetUserId: string;
  createdAt: number;
}

export interface AppState {
  version: number;
  users: Record<string, User>;
  trips: Record<string, Trip>;
  tripMembers: TripMember[];
  tripFavorites: TripFavoriteRelation[];
  activeUserId: string;
}

export interface DemoUserOption {
  id: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  isActive: boolean;
  roleLabel: string;
  currentTripName: string;
  switchLabel: string;
}

export interface BootstrapResult {
  currentUser: User;
  demoUsers: DemoUserOption[];
  homeMode: "landing" | "trip";
  currentTrip: CurrentTripViewModel | null;
}

export interface AccessStateViewModel {
  currentUser: User;
  isAuthorized: boolean;
  hasCurrentTrip: boolean;
}

export interface TripMetaView {
  tripId: string;
  tripName: string;
  departureTime: string;
  password: string;
  templateId: TemplateId;
  seatCount: number;
  seatedCount: number;
  memberCount: number;
  viewerRole: MemberRole;
  viewerRoleLabel: string;
  viewerRoleClassName: string;
  templateLabel: string;
  isAdmin: boolean;
  viewerSeatCode: string | null;
  viewerSeatLabel: string;
}

export interface MemberView {
  userId: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  bio: string;
  livingCity: string;
  hometown: string;
  livingLocationDisplay: LocationDisplay;
  hometownLocationDisplay: LocationDisplay;
  age: string;
  homePersonaImageUrl: string;
  tags: string[];
  tagViews: Array<{
    label: string;
    style: string;
  }>;
  role: MemberRole;
  isAdmin: boolean;
  showMeta: boolean;
  seatCode: string | null;
  seatLabel: string;
  isSelf: boolean;
  isFavoritedByViewer: boolean;
  isMutualFavoriteWithViewer: boolean;
}

export interface SeatOccupantView {
  userId: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  role: MemberRole;
  isSelf: boolean;
}

export interface SeatCellView {
  code: string;
  label: string;
  isEmpty: boolean;
  isMine: boolean;
  isAdmin: boolean;
  className: string;
  showMineBadge: boolean;
  showAdminBadge: boolean;
  occupant: SeatOccupantView | null;
}

export interface SeatRowView {
  rowNumber: number;
  slots: Array<SeatCellView | null>;
}

export interface CurrentTripViewModel {
  tripMeta: TripMetaView;
  seatMap: Record<string, SeatOccupantView | null>;
  seatRows: SeatRowView[];
  members: MemberView[];
}

export interface CreateTripInput {
  tripName: string;
  departureTime: string;
  password: string;
  templateId: TemplateId;
}

export interface UpdateProfileInput {
  tagsInput: string;
  bio: string;
  livingCity: string;
  hometown: string;
  age: string;
}

export interface AuthorizeProfileInput {
  nickname: string;
  avatarUrl: string;
}

export interface ClaimSeatProfileInput {
  profileMode: SeatProfileMode;
  nickname: string;
  avatarUrl: string;
}

export interface TripSettingsViewModel {
  tripId: string;
  tripName: string;
  departureTime: string;
  password: string;
  templateId: TemplateId;
  role: MemberRole;
}

export interface ToolCardView {
  type: ToolType;
  title: string;
  description: string;
  iconGlyph: string;
  iconClassName: string;
  displayTitle: string;
  displayDescription: string;
  imageUrl: string;
  themeKey: ToolType;
  ctaLabel: string;
  sortOrder: number;
  stateLabel: string;
  stateClassName: string;
  helperText: string;
  isStarted: boolean;
  canEnter: boolean;
}

export interface ToolsPageViewModel extends AccessStateViewModel {
  tripName: string;
  viewerRoleLabel: string;
  isAdmin: boolean;
  emptyTitle: string;
  emptyDescription: string;
  toolCards: ToolCardView[];
}

export interface ToolResultMemberView {
  userId: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  seatLabel: string;
  isSelf: boolean;
}

export interface SeatDrawDisplaySlotView {
  id: string;
  label: string;
  isPlaceholder: boolean;
}

export interface SeatDrawRoundResultView {
  id: string;
  labels: string[];
  displayText: string;
}

export interface SeatDrawDetailView {
  phase: SeatDrawPhase;
  topic: string;
  drawCount: number;
  maxDrawCount: number;
  excludePreviouslyDrawn: boolean;
  excludeAdmin: boolean;
  remainingCount: number;
  displaySlots: SeatDrawDisplaySlotView[];
  eligibleMembers: ToolResultMemberView[];
  lastResult: ToolResultMemberView[];
  resultRounds: SeatDrawRoundResultView[];
  canDrawAgain: boolean;
  rollingEndsAt: number | null;
}

export interface VoteOptionView {
  id: string;
  label: string;
  supportCount: number;
  selectedByViewer: boolean;
}

export interface VoteDetailView {
  phase: VotePhase;
  topic: string;
  excludeAdmin: boolean;
  selectionMode: VoteSelectionMode;
  maxSelections: number;
  participantCount: number;
  submittedCount: number;
  approveCount: number;
  rejectCount: number;
  abstainCount: number;
  options: VoteOptionView[];
  resultOptions: VoteOptionView[];
  viewerChoice: VoteChoice | null;
  viewerSelectedOptionIds: string[];
  viewerHasSubmitted: boolean;
  viewerEligible: boolean;
}

export interface WheelDetailView {
  phase: WheelPhase;
  topic: string;
  items: string[];
  viewerCanSpin: boolean;
  allowAssignedUser: boolean;
  assignedUserId: string | null;
  assignedUserLabel: string | null;
  eligibleUsers: ToolResultMemberView[];
  resultIndex: number | null;
  resultLabel: string | null;
  resultHistoryLabels: string[];
}

export interface LotteryCardView {
  id: string;
  order: number;
  state: "available" | "viewer" | "claimed";
  answer: string | null;
  canClaim: boolean;
}

export interface LotteryClaimRecordView {
  cardId: string;
  order: number;
  answer: string;
  claimedAt: number;
}

export interface LotteryDetailView {
  phase: LotteryPhase;
  topic: string;
  answers: string[];
  cardCount: number;
  claimedCardCount: number;
  remainingCardCount: number;
  drawLimitPerUser: number;
  viewerClaimedCount: number;
  viewerRemainingDrawCount: number;
  viewerEligible: boolean;
  viewerCanDraw: boolean;
  allowAssignedUser: boolean;
  assignedUserId: string | null;
  assignedUserLabel: string | null;
  eligibleUsers: ToolResultMemberView[];
  cards: LotteryCardView[];
  viewerClaimRecords: LotteryClaimRecordView[];
}

export interface ToolDetailViewModel extends AccessStateViewModel {
  tripName: string;
  viewerRoleLabel: string;
  isAdmin: boolean;
  toolType: ToolType;
  toolTitle: string;
  toolDescription: string;
  isStarted: boolean;
  phaseLabel: string;
  statusMessage: string;
  seatDrawDetail: SeatDrawDetailView | null;
  voteDetail: VoteDetailView | null;
  wheelDetail: WheelDetailView | null;
  lotteryDetail: LotteryDetailView | null;
}

export interface SeatDrawPublishInput {
  topic: string;
  drawCount: number;
  excludePreviouslyDrawn: boolean;
  excludeAdmin: boolean;
}

export interface VotePublishInput {
  topic: string;
  options: string[];
  selectionMode: VoteSelectionMode;
  maxSelections?: number;
  excludeAdmin: boolean;
}

export interface VoteSubmitInput {
  choice: VoteChoice;
  optionIds: string[];
}

export interface WheelPublishInput {
  topic?: string;
  items: string[];
  allowAssignedUser?: boolean;
  assignedUserId?: string | null;
}

export interface LotteryPublishInput {
  topic?: string;
  answers: string[];
  drawLimitPerUser: number;
  allowAssignedUser?: boolean;
  assignedUserId?: string | null;
}

export type ProfilePrimaryActionKind = "leave" | "dissolve" | "none";

export interface ProfilePageViewModel extends AccessStateViewModel {
  demoUsers: DemoUserOption[];
  seedDemoEnabled: boolean;
  currentUserInitial: string;
  currentTripTitle: string;
  currentSeatLabel: string;
  currentRoleLabel: string;
  profileSummary: string;
  livingLocationDisplay: LocationDisplay;
  hometownLocationDisplay: LocationDisplay;
  tags: string[];
  showTagsCard: boolean;
  showPrimaryAction: boolean;
  primaryActionKind: ProfilePrimaryActionKind;
  primaryActionLabel: string;
}

export interface FavoriteMemberCardView {
  userId: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  seatLabel: string;
  isAdmin: boolean;
  tags: string[];
  tagViews: Array<{
    label: string;
    style: string;
  }>;
  isMutualFavoriteWithViewer: boolean;
}

export interface FavoriteRankingItemView {
  userId: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  seatLabel: string;
  isAdmin: boolean;
  favoriteCount: number;
}

export interface FavoritePageViewModel extends AccessStateViewModel {
  tripName: string;
  viewerRoleLabel: string;
  isAdmin: boolean;
  favoriteLimit: number;
  favoriteCount: number;
  showRankingTab: boolean;
  favorites: FavoriteMemberCardView[];
  ranking: FavoriteRankingItemView[];
}

export interface TagEditorViewModel {
  currentUser: User;
  currentUserInitial: string;
  currentTripTitle: string;
  authNickname: string;
  authAvatarUrl: string;
  currentPersonaId: string;
  currentPersonaImageUrl: string;
  bio: string;
  livingCity: string;
  livingRegion: string[];
  hometown: string;
  hometownRegion: string[];
  age: string;
  tags: string[];
  tagsInput: string;
  previewTags: string[];
}
