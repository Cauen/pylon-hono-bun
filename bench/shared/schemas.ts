import * as z from 'zod'

import type {NewBenchmarkEntry} from './database'

const MAX_NAME_LENGTH = 100
const MAX_MESSAGE_LENGTH = 500

export const newBenchmarkEntrySchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH)
}) satisfies z.ZodType<NewBenchmarkEntry>
