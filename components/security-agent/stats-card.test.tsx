import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/security-agent/stats-card'
import type { LucideIcon } from 'lucide-react'

const MockIcon = () => <div data-testid="icon">Icon</div>

describe('StatsCard Component', () => {
  it('should render card with title and value', () => {
    render(
      <StatsCard 
        title="Total Endpoints" 
        value={42} 
        icon={MockIcon as unknown as LucideIcon}
      />
    )
    
    expect(screen.getByText('Total Endpoints')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should display trend indicator when provided', () => {
    render(
      <StatsCard 
        title="Total Threats" 
        value={10} 
        trend={{ value: 5, isPositive: false }}
        icon={MockIcon as unknown as LucideIcon}
      />
    )
    
    expect(screen.getByText('Total Threats')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    render(
      <StatsCard 
        title="Loading" 
        value={0} 
        icon={MockIcon as unknown as LucideIcon}
      />
    )
    
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('should apply custom description', () => {
    const { container } = render(
      <StatsCard 
        title="Custom" 
        value={100} 
        description="Custom description"
        icon={MockIcon as unknown as LucideIcon}
      />
    )
    
    expect(container.querySelector('p')).toBeInTheDocument()
  })
})
