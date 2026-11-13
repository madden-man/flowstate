// The kind of a page turn (M2, PLAN-MOTION.md): tabs by TABS order, rows in and out by depth, and no turn where the
// page is the same page (a flow's dot moving) or off the tabs on both sides.
import { describe, it, expect } from 'vitest';
import { kindOf } from '../../src/ui/turns';

describe('kindOf', () => {
  it('turns toward the side the new tab is on', () => {
    expect(kindOf('/journal', '/council')).toBe('tab-right');
    expect(kindOf('/flow', '/journal')).toBe('tab-left');
    expect(kindOf('/questions', '/be')).toBe('tab-right');
    expect(kindOf('/flow/panic/2', '/questions')).toBe('tab-left');
  });
  it('opens into a page and closes out of it', () => {
    expect(kindOf('/flow', '/flow/panic')).toBe('open');
    expect(kindOf('/flow/panic/3', '/flow')).toBe('close');
    expect(kindOf('/journal', '/journal/pages')).toBe('open');
    expect(kindOf('/journal/pages', '/journal/abc')).toBe('open');
    expect(kindOf('/journal/abc', '/journal/pages')).toBe('close');
    expect(kindOf('/questions/q1', '/questions')).toBe('close');
    expect(kindOf('/council', '/council/c1')).toBe('open');
    expect(kindOf('/council', '/voices')).toBe('open');
    expect(kindOf('/voices', '/council')).toBe('close');
  });
  it('does not turn within one page', () => {
    expect(kindOf('/flow/panic', '/flow/panic/2')).toBeNull();
    expect(kindOf('/flow/panic/2', '/flow/panic/3')).toBeNull();
    expect(kindOf('/be', '/be')).toBeNull();
  });
  it('turns between two signs\' pages: #/flow/c/heart and #/flow/c/root are two pages (R3 review)', () => {
    expect(kindOf('/flow/c/heart', '/flow/c/root')).toBe('open');
    expect(kindOf('/flow', '/flow/c/root')).toBe('open');
    expect(kindOf('/flow/c/root', '/flow')).toBe('close');
  });
  it('turns through Research\'s pages, each a step deeper: the blank page, Asked, a question, a paper (Q4)', () => {
    expect(kindOf('/flow', '/flow/research')).toBe('open');
    expect(kindOf('/flow/research', '/flow/research/q1')).toBe('open');
    expect(kindOf('/flow/research', '/flow/research/asked')).toBe('open');
    expect(kindOf('/flow/research/asked', '/flow/research/q1')).toBe('open');
    expect(kindOf('/flow/research/q1', '/flow/research/q1/doi%3A10.1%2Fx')).toBe('open');
    expect(kindOf('/flow/research/q1/doi%3A10.1%2Fx', '/flow/research/q1')).toBe('close');
    expect(kindOf('/flow/research/q1', '/flow')).toBe('close');
    expect(kindOf('/flow/research/q1', '/journal')).toBe('tab-left');
  });
});
