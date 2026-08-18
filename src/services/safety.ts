import { z } from "zod";

/**
 * Safety helpers for irreversible or otherwise high-risk Fortnox operations.
 *
 * Fortnox is a bookkeeping system: many write operations are permanent by
 * design (released/bookkept documents are locked, vouchers cannot be deleted,
 * sent emails cannot be recalled). Tools that perform such operations are
 * gated behind an explicit `confirm: true` parameter. When called without it,
 * the tool performs nothing and instead returns a description of what would
 * happen, instructing the model to obtain explicit user approval first.
 */

/**
 * Confirmation field to spread into the schema of every gated tool.
 */
export const ConfirmField = {
  confirm: z.boolean()
    .default(false)
    .describe(
      "Safety gate for an irreversible operation. Must be set to true to actually execute. " +
      "Only set true after the user has explicitly approved this specific action in conversation. " +
      "Calling without confirm: true performs nothing and returns a preview of what would happen."
    )
};

export interface ConfirmInput {
  confirm?: boolean;
}

/**
 * Standard warning block for descriptions of gated tools.
 */
export function irreversibleWarning(consequence: string): string {
  return `⚠️ IRREVERSIBLE: ${consequence}
This tool requires confirm: true to execute. Never set confirm: true unless the user has explicitly approved this specific action. A call without confirm: true is safe and only returns a preview.`;
}

/**
 * Response returned when a gated tool is called without confirm: true.
 * Nothing has been executed against Fortnox.
 */
export function buildConfirmationRequiredResponse(
  actionSummary: string,
  consequence: string
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: {
    executed: false;
    confirmation_required: true;
    action: string;
    consequence: string;
  };
} {
  const text = `# Confirmation Required — Nothing Executed

**Action**: ${actionSummary}

**Consequence**: ${consequence}

This operation is irreversible and was NOT performed. To proceed:
1. Present this action and its consequence to the user.
2. Get their explicit approval for this specific action.
3. Call the tool again with the same arguments plus \`confirm: true\`.`;

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      executed: false,
      confirmation_required: true,
      action: actionSummary,
      consequence
    }
  };
}
