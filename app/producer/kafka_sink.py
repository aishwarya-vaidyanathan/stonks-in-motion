"""Confluent Kafka producer wrapper with delivery callbacks.

Centralises the broker / SASL config so the rest of the producer doesn't
have to know how we talk to Aiven. Uses idempotent producer semantics
(`acks=all` + `enable.idempotence=true`) to avoid duplicate messages on retry.
"""

from __future__ import annotations

import json
import os
from typing import Any

from confluent_kafka import KafkaException, Producer

from ..config import Settings
from ..logging_config import get_logger

log = get_logger(__name__)


class KafkaSink:
    """Thin wrapper around confluent_kafka.Producer with structured delivery logs."""

    def __init__(self, settings: Settings) -> None:
        if settings.kafka_transport != "native":
            raise NotImplementedError(
                f"Kafka transport {settings.kafka_transport!r} is not implemented yet; "
                "use KAFKA_TRANSPORT=native."
            )
        self._topic = settings.kafka_topic
        producer_config: dict[str, Any] = {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "security.protocol": settings.kafka_security_protocol,
            "client.id": f"{settings.kafka_client_id}-producer",
            "acks": "all",
            "enable.idempotence": True,
            "linger.ms": 20,
            "compression.type": "lz4",
            "retries": 5,
        }
        # Only attach SASL credentials when the security protocol actually
        # uses SASL — librdkafka will reject SASL_SSL handshakes if the
        # broker is configured mTLS-only.
        if settings.kafka_security_protocol.startswith("SASL_"):
            producer_config["sasl.mechanism"] = settings.kafka_sasl_mechanism
            producer_config["sasl.username"] = settings.kafka_sasl_username
            producer_config["sasl.password"] = settings.kafka_sasl_password
        # Only pin a CA bundle if the file actually exists. When the user
        # hasn't shipped a cert, fall through to librdkafka's system trust
        # store (Aiven's Let's Encrypt chain is in Ubuntu's ca-certificates).
        ca_path = settings.kafka_ssl_ca_location
        if ca_path and os.path.isfile(ca_path):
            producer_config["ssl.ca.location"] = ca_path
        elif os.path.isfile("/etc/ssl/certs/ca-certificates.crt"):
            producer_config["ssl.ca.location"] = "/etc/ssl/certs/ca-certificates.crt"
        # mTLS: only attach the client cert + key when BOTH files exist on
        # disk. Aiven's Kafka brokers send "certificate required" alerts if
        # they were provisioned with mTLS access certs but the client doesn't
        # present one, so omitting both keeps SASL-only auth working.
        cert_path = settings.kafka_ssl_certificate_location
        key_path = settings.kafka_ssl_key_location
        if cert_path and key_path and os.path.isfile(cert_path) and os.path.isfile(key_path):
            producer_config["ssl.certificate.location"] = cert_path
            producer_config["ssl.key.location"] = key_path
        self._producer = Producer(producer_config)

    def produce(self, payload: dict[str, Any]) -> None:
        """Enqueue one JSON message, keyed by symbol (per-symbol ordering)."""
        key = str(payload["symbol"]).encode("utf-8")
        value = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self._producer.produce(
            topic=self._topic,
            key=key,
            value=value,
            on_delivery=self._on_delivery,
        )
        # Serve delivery callbacks without blocking the event loop.
        self._producer.poll(0)

    def flush(self, timeout_seconds: float = 10.0) -> int:
        """Block until all in-flight messages are delivered (or timeout)."""
        return self._producer.flush(timeout_seconds)

    def _on_delivery(self, err: KafkaException | None, msg: Any) -> None:
        if err is not None:
            log.error(
                "kafka.delivery_failed",
                topic=msg.topic() if msg else self._topic,
                error=str(err),
            )
        else:
            log.info(
                "kafka.delivered",
                topic=msg.topic(),
                partition=msg.partition(),
                offset=msg.offset(),
                key=msg.key().decode("utf-8") if msg.key() else None,
            )
