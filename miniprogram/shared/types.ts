export type TemplateId = "template-49" | "template-53" | "template-57";
export type TripStatus = "active" | "dissolved";
export type MemberRole = "admin" | "member";
export type SeatProfileMode = "wechat" | "custom";

export interface User {
  id: string;
  nickname: string;
  avatarUrl: string;
  tags: string[];
  currentTripId: string | null;
  isAuthorized: boolean;
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
  createdAt: number;
}

export interface TripMember {
  tripId: string;
  userId: string;
  role: MemberRole;
  joinedAt: number;
}

export interface AppState {
  version: number;
  users: Record<string, User>;
  trips: Record<string, Trip>;
  tripMembers: TripMember[];
  activeUserId: string;
}

export interface DemoUserOption {
  id: string;
  nickname: string;
  avatarUrl: string;
  initial: string;
  isActive: boolean;
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
  tags: string[];
  role: MemberRole;
  isAdmin: boolean;
  showMeta: boolean;
  seatCode: string | null;
  seatLabel: string;
  isSelf: boolean;
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

export interface ToolsPageViewModel extends AccessStateViewModel {
  emptyTitle: string;
  emptyDescription: string;
}

export type ProfilePrimaryActionKind = "leave" | "dissolve" | "none";

export interface ProfilePageViewModel extends AccessStateViewModel {
  demoUsers: DemoUserOption[];
  currentUserInitial: string;
  currentTripTitle: string;
  currentSeatLabel: string;
  currentRoleLabel: string;
  tags: string[];
  showTagsCard: boolean;
  showPrimaryAction: boolean;
  primaryActionKind: ProfilePrimaryActionKind;
  primaryActionLabel: string;
}

export interface TagEditorViewModel {
  currentUser: User;
  currentUserInitial: string;
  currentTripTitle: string;
  tags: string[];
  tagsInput: string;
  previewTags: string[];
}
