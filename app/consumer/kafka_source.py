"""Confluent Kafka consumer wrapper.

Mirrors `KafkaSink` on the producer side: thin, structured, easy to mock.
Starts from `auto.offset.reset=latest` so a freshly-deployed consumer
doesn't replay the entire topic; the trade-off is that you must start the
producer first if you want to see messages from boot.
"""

from __future__ import annotations

import json
import os
from typing import Any

from confluent_kafka import Consumer, KafkaError

from ..config import Settings


class KafkaSource:
    """Thin wrapper around confluent_kafka.Consumer."""

    def __init__(self, settings: Settings) -> None:
        if settings.kafka_transport != "native":
            raise NotImplementedError(
                f"Kafka transport {settings.kafka_transport!r} is not implemented yet; "
                "use KAFKA_TRANSPORT=native."
            )
        self._topic = settings.kafka_topic
        consumer_config: dict[str, Any] = {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "security.protocol": settings.kafka_security_protocol,
            "sasl.mechanism": settings.kafka_sasl_mechanism,
            "sasl.username": settings.kafka_sasl_username,
            "sasl.password": settings.kafka_sasl_password,
            "group.id": f"{settings.kafka_client_id}-consumer",
            "client.id": f"{settings.kafka_client_id}-consumer",
            "auto.offset.reset": "latest",
            "enable.auto.commit": True,
        }
        # Only pin a CA bundle if the file actually exists. When the user
        # hasn't shipped a cert, fall through to librdkafka's system trust
        # store (Aiven's Let's Encrypt chain is in Ubuntu's ca-certificates).
        ca_path = settings.kafka_ssl_ca_location
        if ca_path and os.path.isfile(ca_path):
            consumer_config["ssl.ca.location"] = ca_path
        # mTLS: only attach the client cert + key when BOTH files exist on
        # disk. Aiven's Kafka brokers send "certificate required" alerts if
        # they were provisioned with mTLS access certs but the client doesn't
        # present one, so omitting both keeps SASL-only auth working.
        cert_path = settings.kafka_ssl_certificate_location
        key_path = settings.kafka_ssl_key_location
        if cert_path and key_path and os.path.isfile(cert_path) and os.path.isfile(key_path):
            consumer_config["ssl.certificate.location"] = cert_path
            consumer_config["ssl.key.location"] = key_path
        self._consumer = Consumer(consumer_config)

    def subscribe(self) -> None:
        self._consumer.subscribe([self._topic])

    def poll(self, timeout_seconds: float = 1.0) -> Any:
        """Block for up to `timeout_seconds` for a message; returns None on timeout."""
        return self._consumer.poll(timeout_seconds)

    def close(self) -> None:
        self._consumer.close()


def build_record(msg: Any) -> dict[str, Any]:
    """Convert a Kafka message into a JSON-serialisable record for the log file."""
    raw_value = msg.value()
    if raw_value is None:
        value: Any = None
    else:
        try:
            value = json.loads(raw_value)
        except (json.JSONDecodeError, UnicodeDecodeError):
            value = raw_value.decode("utf-8", errors="replace")
    return {
        "topic": msg.topic(),
        "partition": msg.partition(),
        "offset": msg.offset(),
        "key": msg.key().decode("utf-8") if msg.key() else None,
        "value": value,
    }


def is_fatal_error(err: KafkaError) -> bool:
    """True if a Kafka error is unrecoverable and the consumer should bail."""
    return err.fatal() if err is not None else False
