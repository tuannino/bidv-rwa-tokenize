'use server';

import {
  cancelRecall, freezeToken, getRecallOverview, openRecall, recallBatch,
  rescheduleRecall, unfreezeToken,
} from '@/lib/bank/recall.service';

export async function getRecallOverviewAction(input: unknown) { return getRecallOverview(input); }
export async function openRecallAction(input: unknown) { return openRecall(input); }
export async function cancelRecallAction(input: unknown) { return cancelRecall(input); }
export async function rescheduleRecallAction(input: unknown) { return rescheduleRecall(input); }
export async function freezeTokenAction(input: unknown) { return freezeToken(input); }
export async function unfreezeTokenAction(input: unknown) { return unfreezeToken(input); }
export async function recallBatchAction(input: unknown) { return recallBatch(input); }
