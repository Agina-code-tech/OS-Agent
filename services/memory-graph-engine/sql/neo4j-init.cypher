CREATE CONSTRAINT memory_node_canonical IF NOT EXISTS
FOR (n:Memory)
REQUIRE (n.userId, n.canonicalKey) IS UNIQUE;

CREATE INDEX memory_node_user_id IF NOT EXISTS
FOR (n:Memory)
ON (n.userId);

CREATE INDEX memory_node_label IF NOT EXISTS
FOR (n:Memory)
ON (n.label);

