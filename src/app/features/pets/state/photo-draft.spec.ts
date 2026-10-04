import { movePhoto } from './photo-draft';

describe('movePhoto', () => {
  it('moves an item to the front (new main photo)', () => {
    expect(movePhoto(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('moves an item one step right', () => {
    expect(movePhoto(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input', () => {
    const items = ['a', 'b'];
    movePhoto(items, 1, 0);
    expect(items).toEqual(['a', 'b']);
  });
});
