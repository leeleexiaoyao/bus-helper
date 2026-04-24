import { TRIP_TEMPLATES } from "./constants";
import type {
  MemberRole,
  MemberView,
  SeatCellView,
  SeatOccupantView,
  SeatRowView,
  TemplateId
} from "./types";

const LETTERS = ["A", "B", "C", "D", "E"];

export function getTemplateConfig(templateId: TemplateId) {
  const template = TRIP_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return template;
}

export function generateSeatCodes(templateId: TemplateId): string[] {
  return getTemplateConfig(templateId).rowSeatCounts.flatMap((seatCount, rowIndex) =>
    LETTERS.slice(0, seatCount).map((letter) => `${rowIndex + 1}${letter}`)
  );
}

export function createSeatMap(seatCodes: string[]): Record<string, string | null> {
  return seatCodes.reduce<Record<string, string | null>>((accumulator, seatCode) => {
    accumulator[seatCode] = null;
    return accumulator;
  }, {});
}

export function findSeatCodeByUserId(
  seatMap: Record<string, string | null>,
  userId: string
): string | null {
  return (
    Object.entries(seatMap).find(([, occupiedUserId]) => occupiedUserId === userId)?.[0] ?? null
  );
}

export function buildSeatRows(
  seatCodes: string[],
  seatMap: Record<string, SeatOccupantView | null>,
  viewerId: string
): SeatRowView[] {
  const grouped = seatCodes.reduce<Record<number, string[]>>((accumulator, seatCode) => {
    const rowNumber = Number.parseInt(seatCode, 10);
    if (!accumulator[rowNumber]) {
      accumulator[rowNumber] = [];
    }
    accumulator[rowNumber].push(seatCode);
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([rowNumber, rowSeats]) => {
      const slots: Array<SeatCellView | null> = [];
      const orderedRowSeats = reorderRowSeats(rowSeats);
      const seatCount = orderedRowSeats.length;

      orderedRowSeats.forEach((seatCode, index) => {
        if (seatCount === 4 && index === 2) {
          slots.push(null);
        }

        const occupant = seatMap[seatCode];
        const isMine = occupant?.userId === viewerId;
        const isAdmin = occupant?.role === "admin";
        slots.push({
          code: seatCode,
          label: seatCode,
          isEmpty: occupant === null,
          isMine,
          isAdmin: Boolean(isAdmin),
          className: [
            occupant === null ? "is-empty" : "is-occupied",
            isMine ? "is-mine" : "",
            isAdmin ? "is-admin" : ""
          ]
            .filter(Boolean)
            .join(" "),
          showMineBadge: isMine,
          showAdminBadge: Boolean(isAdmin),
          occupant
        });
      });

      return {
        rowNumber: Number(rowNumber),
        slots
      };
    })
    .sort((left, right) => left.rowNumber - right.rowNumber);
}

export function buildSeatOccupantMap(
  seatMap: Record<string, string | null>,
  members: MemberView[]
): Record<string, SeatOccupantView | null> {
  const memberMap = members.reduce<Record<string, MemberView>>((accumulator, member) => {
    accumulator[member.userId] = member;
    return accumulator;
  }, {});

  return Object.entries(seatMap).reduce<Record<string, SeatOccupantView | null>>(
    (accumulator, [seatCode, userId]) => {
      if (!userId) {
        accumulator[seatCode] = null;
        return accumulator;
      }

      const member = memberMap[userId];
      accumulator[seatCode] = member
        ? {
            userId: member.userId,
            nickname: member.nickname,
            avatarUrl: member.avatarUrl,
            initial: member.initial,
            role: member.role,
            isSelf: member.isSelf
          }
        : null;
      return accumulator;
    },
    {}
  );
}

export function sortMembers(left: MemberView, right: MemberView): number {
  const leftRoleScore = roleScore(left.role);
  const rightRoleScore = roleScore(right.role);
  if (leftRoleScore !== rightRoleScore) {
    return rightRoleScore - leftRoleScore;
  }

  if (Boolean(left.seatCode) !== Boolean(right.seatCode)) {
    return Number(Boolean(right.seatCode)) - Number(Boolean(left.seatCode));
  }

  return left.nickname.localeCompare(right.nickname, "zh-Hans-CN");
}

function roleScore(role: MemberRole): number {
  return role === "admin" ? 2 : 1;
}

function reorderRowSeats(rowSeats: string[]): string[] {
  if (rowSeats.length !== 5) {
    return rowSeats;
  }

  const findSeat = (letter: string) => rowSeats.find((seatCode) => seatCode.endsWith(letter));
  const orderedSeats = ["A", "B", "E", "C", "D"]
    .map((letter) => findSeat(letter))
    .filter((seatCode): seatCode is string => Boolean(seatCode));

  return orderedSeats.length === rowSeats.length ? orderedSeats : rowSeats;
}
