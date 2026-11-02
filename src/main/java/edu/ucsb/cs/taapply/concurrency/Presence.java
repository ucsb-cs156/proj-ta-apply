package edu.ucsb.cs.taapply.concurrency;

import java.util.List;

/**
 * What a heartbeat is answered with (issue #273): who else is active on the resource, and how often
 * to send the next heartbeat. It is the JSON body of the answer: {@code {"others": [{"label":
 * "...", "samePerson": false}], "heartbeatSeconds": 20}}.
 */
public record Presence(List<OtherClient> others, long heartbeatSeconds) {}
