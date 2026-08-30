// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerSwitcher } from '@/components/PlayerSwitcher';
import { rememberPlayer } from '@/lib/player-switcher';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe('PlayerSwitcher — chooser variant (/signup)', () => {
  it('renders nothing when no players are remembered', () => {
    const { container } = render(<PlayerSwitcher variant="chooser" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders remembered players and navigates straight to their page on click', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    render(<PlayerSwitcher variant="chooser" />);

    await user.click(screen.getByRole('button', { name: 'TestFirst One' }));

    expect(push).toHaveBeenCalledWith('/player/p1');
  });

  it('requires a second click to remove a player, and does not navigate', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    render(<PlayerSwitcher variant="chooser" />);

    await user.click(screen.getByRole('button', { name: 'Remove TestFirst One from this device' }));
    expect(
      screen.getByRole('button', { name: 'Confirm removing TestFirst One from this device' })
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm removing TestFirst One from this device' }));

    expect(screen.queryByText('TestFirst One')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('arming remove on one player resets a previously-armed remove on another', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    render(<PlayerSwitcher variant="chooser" />);

    await user.click(screen.getByRole('button', { name: 'Remove TestFirst One from this device' }));
    await user.click(screen.getByRole('button', { name: 'Remove TestFirst Two from this device' }));

    expect(screen.getByRole('button', { name: 'Remove TestFirst One from this device' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm removing TestFirst Two from this device' })
    ).toBeInTheDocument();
  });

  it('reverts an armed remove back to "Remove" when clicking elsewhere', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    render(
      <div>
        <PlayerSwitcher variant="chooser" />
        <button type="button">elsewhere</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Remove TestFirst One from this device' }));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.getByRole('button', { name: 'Remove TestFirst One from this device' })).toBeInTheDocument();
  });
});

describe('PlayerSwitcher — header variant (/player/[playerId])', () => {
  it('shows the current-player control even with no other remembered players', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    render(<PlayerSwitcher variant="header" currentPlayerId="p1" />);

    expect(screen.getByRole('button', { name: 'Player menu for TestFirst One' })).toBeInTheDocument();
  });

  it('opens the menu and lists other remembered players', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    render(<PlayerSwitcher variant="header" currentPlayerId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Player menu for TestFirst One' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TestFirst Two' })).toBeInTheDocument();
  });

  it('switching to another remembered player navigates and closes the menu', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    render(<PlayerSwitcher variant="header" currentPlayerId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Player menu for TestFirst One' }));
    await user.click(screen.getByRole('button', { name: 'TestFirst Two' }));

    expect(push).toHaveBeenCalledWith('/player/p2');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('removing the current player requires confirmation, then forgets it and returns to /signup', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    render(<PlayerSwitcher variant="header" currentPlayerId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Player menu for TestFirst One' }));
    await user.click(screen.getByRole('button', { name: 'Remove TestFirst One from this device' }));
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm removing TestFirst One from this device' }));

    expect(push).toHaveBeenCalledWith('/signup');
  });

  it('removing another remembered player from the menu also requires confirmation', async () => {
    const user = userEvent.setup();
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    render(<PlayerSwitcher variant="header" currentPlayerId="p1" />);

    await user.click(screen.getByRole('button', { name: 'Player menu for TestFirst One' }));
    await user.click(screen.getByRole('button', { name: 'Remove TestFirst Two from this device' }));
    expect(screen.queryByText('TestFirst Two')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm removing TestFirst Two from this device' }));

    expect(screen.queryByText('TestFirst Two')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith('/signup');
  });
});
