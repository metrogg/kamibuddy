"""Component registry and dispatcher for html_to_docx.

Usage:
    @register("callout")
    def render_callout(element, document) -> None: ...

    render_component(soup_element, document)  # dispatches to registered renderer
"""
from __future__ import annotations

import importlib
import pkgutil
import warnings
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from bs4 import Tag
    from docx.document import Document as DocxDocument
    from docx.text.paragraph import Paragraph

_registry: dict[str, Callable] = {}


def register(component_type: str):
    """Decorator to register a component renderer function."""
    def decorator(fn: Callable) -> Callable:
        _registry[component_type] = fn
        return fn
    return decorator


def render_component(element: Tag, document: DocxDocument, anchor: Paragraph | None = None) -> bool:
    """Dispatch *element* to its registered renderer.

    Returns True if rendered, False if no renderer found (also emits a warning).
    The element is a BeautifulSoup Tag; dispatch key is ``data-component`` attribute.
    """
    comp_type = element.get("data-component", "")

    if comp_type and comp_type in _registry:
        _registry[comp_type](element, document, anchor)
        return True

    if comp_type:
        warnings.warn(
            f"Unknown component type: {comp_type!r}; skipping element.",
            stacklevel=2,
        )
    return False


def _auto_import() -> None:
    """Import all sibling modules so their @register decorators fire."""
    import html_to_docx.components as _pkg  # noqa: PLC0415

    for _, module_name, _ in pkgutil.iter_modules(_pkg.__path__):
        importlib.import_module(f"html_to_docx.components.{module_name}")


_auto_import()
