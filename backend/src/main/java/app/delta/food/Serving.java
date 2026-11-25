package app.delta.food;

/** A named portion of a food, e.g. "1 шт" = 55 g. */
public record Serving(String ru, String en, double g) {
    public String label(String lang) {
        return "en".equals(lang) ? en : ru;
    }
}
