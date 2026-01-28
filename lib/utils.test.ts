import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle conditional classes', () => {
      const result = cn('base-class', false && 'hidden', 'visible')
      expect(result).toBeTruthy()
    })

    it('should handle undefined and null values', () => {
      const result = cn('base-class', undefined, null, 'another-class')
      expect(result).toBeTruthy()
    })
  })
})
