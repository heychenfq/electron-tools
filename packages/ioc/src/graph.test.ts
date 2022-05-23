
import Graph from './graph';

interface Data {
  id: string;
}

it('roots() should return all nodes which outgoing node is empty', () => {
  // build graph
  const graph = new Graph<Data>((data) => data.id);
  const data1 = { id: '1' };
  const data2 = { id: '2' };
  const data3 = { id: '3' };
  graph.insertEdge(data1, data2);
  graph.insertEdge(data3, data2);

  const roots = graph.roots();
  expect(roots.length).toBe(1);
  expect(roots[0].data).toBe(data2);
});

it('isEmpty() should return true if there is no node inside it, otherwise return false', () => {
  const graph = new Graph<Data>((data) => data.id);
  expect(graph.isEmpty()).toBe(true);
  graph.lookupOrInsertNode({ id: '1' });
  expect(graph.isEmpty()).toBe(false);
  graph.removeNode({ id: '1' });
  expect(graph.isEmpty()).toBe(true);
});

it('lookupOrInsertNode() should insert node if node is not exist', () => {
  const graph = new Graph<Data>((data) => data.id);
  const node = graph.lookupOrInsertNode({ id: '1' });
  const node2 = graph.lookupOrInsertNode({ id: '1' });
  expect(node).toBe(node2);
});

it('removeNode() should work', () => {
  const graph = new Graph<Data>((data) => data.id);
  graph.lookupOrInsertNode({ id: '1' });
  graph.removeNode({ id: '1' });
  expect(graph.isEmpty()).toBe(true);
});

it('removeNode() should also remove the edge related to nodes', () => {
  const graph = new Graph<Data>((data) => data.id);
  graph.lookupOrInsertNode({ id: '1' });
  graph.lookupOrInsertNode({ id: '2' });
  graph.insertEdge({ id: '1' }, { id: '2' });
  expect(graph.roots()[0].data).toEqual({ id: '2' });
  graph.removeNode({ id: '2' });
  expect(graph.roots()[0].data).toEqual({ id: '1' });
});

it('lookup() should return the node if node exist, otherwise return undefined', () => {
  const graph = new Graph<Data>((data) => data.id);
  graph.lookupOrInsertNode({ id: '1' });
  expect(graph.lookup({ id: '1' })!.data).toEqual({ id: '1' });
  expect(graph.lookup({ id: '2' })).toBeUndefined();
});

it('findCycleSlow() should find the cycle related between nodes', () => {
  const graph = new Graph<Data>((data) => data.id);
  graph.insertEdge({ id: '1' }, { id: '2' });
  graph.insertEdge({ id: '2' }, { id: '3' });
  graph.insertEdge({ id: '2' }, { id: '4' });
  graph.insertEdge({ id: '4' }, { id: '5' });
  graph.insertEdge({ id: '5' }, { id: '1' });
  expect(graph.findCycleSlow()).not.toBeUndefined();
  graph.removeNode({ id: '1' });
  expect(graph.findCycleSlow()).toBeUndefined();
});

it('toString() should list all nodes ingoing and outgoing', () => {
  const graph = new Graph<Data>((data) => data.id);
  graph.insertEdge({ id: '1' }, { id: '2' });
  graph.insertEdge({ id: '2' }, { id: '3' });
  graph.insertEdge({ id: '2' }, { id: '4' });
  graph.insertEdge({ id: '4' }, { id: '5' });
  graph.insertEdge({ id: '5' }, { id: '1' });
  expect(graph.toString()).not.toBeUndefined();
});