package app.delta.food;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Open Food Facts (free, open database of packaged products). Product reads are limited to 100/min and
 * searches to 10/min per IP, so search results are cached and searching online is only done on request.
 */
@Component
public class OpenFoodFactsClient {

    private static final Logger log = LoggerFactory.getLogger(OpenFoodFactsClient.class);
    private static final String FIELDS =
            "code,product_name,product_name_ru,product_name_en,brands,nutriments,serving_quantity,serving_size,quantity";
    private static final Duration SEARCH_TTL = Duration.ofHours(6);
    private static final Pattern QUANTITY = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(g|г|гр|ml|мл)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** A product as Open Food Facts describes it, per 100 g. */
    public record Product(String barcode, String nameRu, String nameEn, String brand, double kcal, double protein,
                          double fat, double carbs, Double fiber, Double sugar, List<Serving> servings) {}

    private record Cached(List<Product> products, Instant at) {}

    private final RestClient http;
    private final RestClient searchHttp;
    private final Map<String, Cached> searchCache = new ConcurrentHashMap<>();

    public OpenFoodFactsClient(@Value("${delta.off.base-url:https://world.openfoodfacts.org}") String baseUrl,
                               @Value("${delta.off.search-url:https://search.openfoodfacts.org}") String searchUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(8000);
        this.http = client(baseUrl, factory);
        // The classic /cgi/search.pl is overloaded and often answers 503 to anonymous clients;
        // search-a-licious is the newer, faster search service and handles Russian well.
        this.searchHttp = client(searchUrl, factory);
    }

    private static RestClient client(String baseUrl, SimpleClientHttpRequestFactory factory) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("User-Agent", "DeltaFitness/1.0 (student MVP)")
                .build();
    }

    public Optional<Product> byBarcode(String barcode) {
        try {
            JsonNode r = http.get().uri("/api/v2/product/{code}?fields={f}", barcode, FIELDS)
                    .retrieve().body(JsonNode.class);
            if (r == null || r.path("status").asInt() != 1) return Optional.empty();
            return map(r.path("product"));
        } catch (RestClientException e) {
            log.warn("OFF barcode {} failed: {}", barcode, e.getMessage());
            return Optional.empty();
        }
    }

    /** Empty on rate limit or timeout: the online part of search is a bonus, never a failure. */
    public List<Product> search(String query) {
        String key = query.toLowerCase();
        Cached c = searchCache.get(key);
        if (c != null && c.at().plus(SEARCH_TTL).isAfter(Instant.now())) return c.products();
        try {
            JsonNode r = searchHttp.get()
                    .uri(u -> u.path("/search")
                            .queryParam("q", query)
                            .queryParam("page_size", 24)
                            .queryParam("fields", FIELDS)
                            .build())
                    .retrieve().body(JsonNode.class);
            List<Product> out = new ArrayList<>();
            if (r != null) for (JsonNode p : r.path("hits")) map(p).ifPresent(out::add);
            if (searchCache.size() > 500) searchCache.clear();
            searchCache.put(key, new Cached(out, Instant.now()));
            return out;
        } catch (RestClientException e) {
            log.warn("OFF search '{}' failed: {}", query, e.getMessage());
            return List.of();
        }
    }

    static Optional<Product> map(JsonNode p) {
        JsonNode n = p.path("nutriments");
        Double kcal = num(n, "energy-kcal_100g");
        if (kcal == null) {
            Double kj = num(n, "energy_100g");
            if (kj != null) kcal = kj / 4.184;
        }
        String barcode = p.path("code").asText("");
        String ru = text(p, "product_name_ru");
        String en = text(p, "product_name_en");
        String any = text(p, "product_name");
        if (kcal == null || barcode.isBlank() || (ru == null && en == null && any == null)) return Optional.empty();

        List<Serving> servings = new ArrayList<>();
        Double servingG = p.hasNonNull("serving_quantity") ? p.path("serving_quantity").asDouble() : null;
        if (servingG != null && servingG > 0 && servingG < 3000) {
            String label = text(p, "serving_size");
            servings.add(new Serving(label != null ? "1 порция (" + label + ")" : "1 порция",
                    label != null ? "1 serving (" + label + ")" : "1 serving", servingG));
        }
        String quantity = text(p, "quantity");
        if (quantity != null) {
            Matcher m = QUANTITY.matcher(quantity);
            if (m.find()) {
                double q = Double.parseDouble(m.group(1).replace(',', '.'));
                if (q > 0 && q < 5000) servings.add(new Serving("Упаковка (" + quantity + ")", "Package (" + quantity + ")", q));
            }
        }
        String brand = brand(p.path("brands"));
        return Optional.of(new Product(barcode,
                ru != null ? ru : any != null ? any : en,
                en != null ? en : any != null ? any : ru,
                brand, kcal, orZero(num(n, "proteins_100g")), orZero(num(n, "fat_100g")),
                orZero(num(n, "carbohydrates_100g")), num(n, "fiber_100g"), num(n, "sugars_100g"), servings));
    }

    /** "brands" is a comma-separated string in the product API and an array in search ("xx:Snickers"). */
    private static String brand(JsonNode b) {
        String first = b.isArray() ? (b.isEmpty() ? "" : b.get(0).asText("")) : b.asText("");
        if (first.contains(",")) first = first.substring(0, first.indexOf(','));
        if (first.matches("^[a-z]{2}:.*")) first = first.substring(3);
        first = first.trim();
        return first.isEmpty() ? null : first;
    }

    private static String text(JsonNode p, String field) {
        String s = p.path(field).asText("").trim();
        return s.isEmpty() ? null : s.length() > 150 ? s.substring(0, 150) : s;
    }

    private static Double num(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) return null;
        double d = v.isNumber() ? v.asDouble() : parse(v.asText());
        return Double.isNaN(d) || d < 0 ? null : d;
    }

    private static double parse(String s) {
        try {
            return Double.parseDouble(s.replace(',', '.'));
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    private static double orZero(Double d) {
        return d == null ? 0 : d;
    }
}
