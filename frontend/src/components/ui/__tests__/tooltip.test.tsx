import { render, screen } from '@testing-library/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

describe('Tooltip', () => {
  it('works without a provider above it (no root TooltipProvider in the app)', () => {
    render(
      <Tooltip open>
        <TooltipTrigger>Rates</TooltipTrigger>
        <TooltipContent>Frankfurter, updated daily</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Rates' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Frankfurter, updated daily');
  });

  it('still works inside an explicit provider', () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip open>
          <TooltipTrigger>Plug</TooltipTrigger>
          <TooltipContent>Type A</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Type A');
  });
});
