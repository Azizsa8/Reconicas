from reconicas.adapters.salla import extract_product_from_jsonld

_PRODUCT_PAGE = """
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Oud Perfume 50ml",
  "sku": "OUD-50",
  "productID": "12345",
  "offers": {
    "@type": "Offer",
    "price": "199.00",
    "priceCurrency": "SAR",
    "availability": "https://schema.org/InStock"
  }
}
</script>
</head><body></body></html>
"""

_GRAPH_PAGE = """
<script type="application/ld+json">
{"@graph": [
  {"@type": "BreadcrumbList"},
  {"@type": "Product", "name": "Abaya Classic", "sku": "AB-1",
   "offers": [{"@type": "Offer", "price": 349.5, "priceCurrency": "SAR"}]}
]}
</script>
"""


def test_extracts_basic_product():
    product = extract_product_from_jsonld(_PRODUCT_PAGE, "https://store.salla.sa/p/1")
    assert product is not None
    assert product.name == "Oud Perfume 50ml"
    assert product.sku == "OUD-50"
    assert product.external_id == "12345"
    assert product.price == 199.0
    assert product.currency == "SAR"
    assert product.availability == "InStock"


def test_extracts_product_from_graph_and_offer_list():
    product = extract_product_from_jsonld(_GRAPH_PAGE, "https://store.salla.sa/p/2")
    assert product is not None
    assert product.name == "Abaya Classic"
    assert product.price == 349.5


def test_returns_none_for_non_product_page():
    html = '<script type="application/ld+json">{"@type": "WebSite"}</script>'
    assert extract_product_from_jsonld(html, "https://store.salla.sa") is None


def test_returns_none_when_price_missing():
    html = """
    <script type="application/ld+json">
    {"@type": "Product", "name": "No Price", "offers": {"@type": "Offer"}}
    </script>
    """
    assert extract_product_from_jsonld(html, "https://store.salla.sa/p/3") is None


def test_ignores_malformed_jsonld():
    html = '<script type="application/ld+json">{ not json </script>'
    assert extract_product_from_jsonld(html, "https://store.salla.sa") is None
