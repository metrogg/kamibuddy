"""CSS variable resolver — Phase 0 preprocessor.

Extracts --xxx: value declarations from :root blocks in <style> tags,
then replaces all var(--xxx) / var(--xxx, fallback) references throughout
inline style attributes and <style> block content.
"""
from __future__ import annotations

import re
import warnings
from bs4 import BeautifulSoup

# Matches :root { ... } blocks (non-greedy, handles nested braces)
_ROOT_BLOCK_RE = re.compile(r':root\s*\{([^}]*)\}', re.DOTALL)

# Matches CSS custom property declarations: --name: value;
_VAR_DECL_RE = re.compile(r'(--[\w-]+)\s*:\s*([^;}\n]+?)(?:\s*;|\s*$)', re.MULTILINE)

# Matches var(--name) or var(--name, fallback) — handles simple fallbacks
_VAR_USE_RE = re.compile(r'var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)')

_MAX_DEPTH = 3


def _self_ref_match(value: str, name: str) -> str | None:
    """Return the inline fallback if `value` is a self-reference to `name`.

    A "self-reference" means the value's outermost var() references the same
    custom-property name, e.g. for name=`--x`:
      "var(--x)"            -> returns ""    (self-ref, no inline fallback)
      "var(--x, #ccc)"      -> returns "#ccc"
      "var(--x , 1px solid)"-> returns "1px solid"
      "#ccc"                -> returns None  (not a self-reference)
      "var(--y)"            -> returns None  (references a different var)

    Returns None when `value` is not a self-reference.
    """
    stripped = value.strip()
    m = _VAR_USE_RE.fullmatch(stripped)
    if m is None:
        return None
    if m.group(1) != name:
        return None
    fb = m.group(2)
    return fb.strip() if fb is not None else ''


def _extract_vars(style_text: str) -> dict[str, str]:
    """Extract all --xxx: value declarations from :root blocks."""
    variables: dict[str, str] = {}
    for root_match in _ROOT_BLOCK_RE.finditer(style_text):
        block_content = root_match.group(1)
        for decl_match in _VAR_DECL_RE.finditer(block_content):
            name = decl_match.group(1).strip()
            value = decl_match.group(2).strip()
            variables[name] = value
    return variables


def _replace_vars(text: str, variables: dict[str, str], depth: int = 0) -> str:
    """Replace var() references in text using the variables table."""
    if depth >= _MAX_DEPTH:
        warnings.warn(
            f"CSS variable nesting depth exceeded {_MAX_DEPTH} levels; stopping resolution.",
            stacklevel=2,
        )
        return text

    def replacer(m: re.Match) -> str:
        name = m.group(1)
        fallback = m.group(2)
        if name in variables:
            resolved = variables[name]
            # Detect self-referential declaration, e.g.
            #   --color-border: var(--color-border, #C9B99A);
            # This is a common "overridable default" pattern. Since --name is
            # not actually overridden here (we only have the fallback branch),
            # use the call-site fallback if present, otherwise the inline
            # fallback embedded in the declaration.
            self_ref = _self_ref_match(resolved, name)
            if self_ref is not None:
                inline_fallback = self_ref
                if fallback is not None:
                    resolved = fallback.strip()
                elif inline_fallback:
                    resolved = inline_fallback
                else:
                    return m.group(0)  # cannot resolve, leave as-is
        elif fallback is not None:
            resolved = fallback.strip()
        else:
            return m.group(0)  # leave unresolved var() as-is

        # Recursively resolve if the value itself contains var()
        if 'var(' in resolved:
            resolved = _replace_vars(resolved, variables, depth + 1)
        return resolved

    return _VAR_USE_RE.sub(replacer, text)


def _remove_root_custom_props(style_text: str) -> str:
    """Remove --xxx: value; declarations from :root blocks."""
    def clean_root_block(m: re.Match) -> str:
        block = m.group(1)
        # Remove custom property lines
        cleaned = _VAR_DECL_RE.sub('', block)
        # If only whitespace left, remove the entire :root block
        if cleaned.strip():
            return ':root {' + cleaned + '}'
        return ''

    return _ROOT_BLOCK_RE.sub(clean_root_block, style_text)


def resolve(html: str) -> str:
    """Resolve all CSS var() references in html.

    Steps:
    1. Parse HTML with bs4/lxml.
    2. Extract all --xxx: value declarations from <style> :root blocks.
    3. Replace var(--xxx) / var(--xxx, fallback) in all inline style
       attributes and <style> block content.
    4. Remove resolved :root custom property declarations.
    5. Return the modified HTML string.
    """
    soup = BeautifulSoup(html, 'lxml')

    # Step 1: collect variables from all <style> tags
    variables: dict[str, str] = {}
    for style_tag in soup.find_all('style'):
        variables.update(_extract_vars(style_tag.string or ''))

    # Even with no variables, we still need to process fallbacks in inline styles.
    # Only skip if there are no var() references at all in the HTML.
    if not variables and 'var(' not in html:
        return html

    # Step 2: replace var() in <style> tag content
    for style_tag in soup.find_all('style'):
        original = style_tag.string or ''
        resolved = _replace_vars(original, variables)
        resolved = _remove_root_custom_props(resolved)
        style_tag.string = resolved

    # Step 3: replace var() in inline style attributes
    for tag in soup.find_all(style=True):
        tag['style'] = _replace_vars(tag['style'], variables)

    return str(soup)
