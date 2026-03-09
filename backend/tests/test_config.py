from unittest.mock import patch

from app.config import (
    UnifiCredentials,
    clear_runtime_credentials,
    get_credential_source,
    get_unifi_config,
    has_credentials,
    set_runtime_credentials,
    settings,
)


def test_unifi_credentials_frozen() -> None:
    cred = UnifiCredentials(url="https://x.com", username="u", password="p")
    assert cred.url == "https://x.com"
    assert cred.site == "default"
    assert cred.verify_ssl is False


def test_set_and_get_runtime_credentials() -> None:
    clear_runtime_credentials()
    assert get_unifi_config() is None  # no env vars set in test

    set_runtime_credentials(
        url="https://test.local",
        username="admin",
        password="pass123",
        site="mysite",
        verify_ssl=True,
    )

    config = get_unifi_config()
    assert config is not None
    assert config.url == "https://test.local"
    assert config.username == "admin"
    assert config.password == "pass123"
    assert config.site == "mysite"
    assert config.verify_ssl is True

    clear_runtime_credentials()
    assert get_unifi_config() is None


def test_has_credentials_without_any() -> None:
    clear_runtime_credentials()
    assert has_credentials() is False


def test_has_credentials_with_runtime() -> None:
    set_runtime_credentials(url="https://x.com", username="u", password="p")
    assert has_credentials() is True
    clear_runtime_credentials()


def test_clear_is_idempotent() -> None:
    clear_runtime_credentials()
    clear_runtime_credentials()  # should not raise
    assert get_unifi_config() is None


def test_get_credential_source_none() -> None:
    clear_runtime_credentials()
    assert get_credential_source() == "none"


def test_get_credential_source_runtime() -> None:
    set_runtime_credentials(url="https://x.com", username="u", password="p")
    assert get_credential_source() == "runtime"
    clear_runtime_credentials()


def test_get_unifi_config_from_env() -> None:
    clear_runtime_credentials()
    with (
        patch.object(settings, "unifi_url", "https://env.local"),
        patch.object(settings, "unifi_user", "envuser"),
        patch.object(settings, "unifi_pass", "envpass"),
        patch.object(settings, "unifi_site", "mysite"),
        patch.object(settings, "unifi_verify_ssl", True),
    ):
        config = get_unifi_config()
        assert config is not None
        assert config.url == "https://env.local"
        assert config.username == "envuser"
        assert config.site == "mysite"
        assert config.verify_ssl is True


def test_get_credential_source_env() -> None:
    clear_runtime_credentials()
    with (
        patch.object(settings, "unifi_url", "https://env.local"),
        patch.object(settings, "unifi_user", "u"),
        patch.object(settings, "unifi_pass", "p"),
    ):
        assert get_credential_source() == "env"
