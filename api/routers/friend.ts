import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import {
  findUserByShareToken,
  findTradesByUserId,
  createFriendLink,
  findFriendLinksByViewer,
  findUserById,
  deleteFriendLink,
} from "../lib/sheets-queries";
import crypto from "crypto";

export const friendRouter = createRouter({
  // Read-only view by share token (no auth required)
  viewByToken: publicQuery
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      const user = await findUserByShareToken(input.shareToken);
      if (!user) {
        return { success: false, error: "Invalid share link" } as const;
      }
      const trades = await findTradesByUserId(user.id);
      return {
        success: true,
        friend: {
          id: user.id,
          name: user.name,
          shareToken: user.shareToken,
        },
        trades,
      } as const;
    }),

  addFriend: authedQuery
    .input(z.object({ shareToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const friend = await findUserByShareToken(input.shareToken);
      if (!friend) {
        return { success: false, error: "Invalid share token" } as const;
      }
      if (friend.id === ctx.user.id) {
        return { success: false, error: "You cannot add yourself" } as const;
      }
      const existing = await findFriendLinksByViewer(ctx.user.id);
      if (existing.some((f) => f.ownerUserId === friend.id)) {
        return { success: false, error: "Already friends" } as const;
      }
      await createFriendLink({
        id: crypto.randomUUID(),
        ownerUserId: friend.id,
        viewerUserId: ctx.user.id,
        shareToken: input.shareToken,
        createdAt: new Date().toISOString(),
      });
      return {
        success: true,
        friend: { id: friend.id, name: friend.name, shareToken: friend.shareToken },
      } as const;
    }),

  myFriends: authedQuery.query(async ({ ctx }) => {
    const links = await findFriendLinksByViewer(ctx.user.id);
    const friends = [];
    for (const link of links) {
      const owner = await findUserById(link.ownerUserId);
      if (owner) {
        friends.push({
          id: owner.id,
          name: owner.name,
          shareToken: owner.shareToken,
          linkId: link.id,
        });
      }
    }
    return { friends };
  }),

  removeFriend: authedQuery
    .input(z.object({ linkId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const links = await findFriendLinksByViewer(ctx.user.id);
      const link = links.find((l) => l.id === input.linkId);
      if (!link) {
        return { success: false, error: "Friend not found" } as const;
      }
      await deleteFriendLink(input.linkId);
      return { success: true } as const;
    }),
});
