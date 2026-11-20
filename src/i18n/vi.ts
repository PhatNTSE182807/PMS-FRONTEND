import { part01 } from './vi/part01'
import { part02 } from './vi/part02'
import { part03 } from './vi/part03'
import { part04 } from './vi/part04'
import { part05 } from './vi/part05'
import { part06 } from './vi/part06'
import { part07 } from './vi/part07'
import { part08 } from './vi/part08'
import { part09 } from './vi/part09'

/**
 * Vietnamese UI text keyed by the English text. A missing entry falls back to English.
 * Parts 01–06 hold the text written in components; 07–09 hold labels, status names and messages declared
 * outside them (label maps, validation and error messages). Keep `{placeholders}` identical to the key.
 */
export const vi: Record<string, string> = {
  ...part01,
  ...part02,
  ...part03,
  ...part04,
  ...part05,
  ...part06,
  ...part07,
  ...part08,
  ...part09,
}
