package app.delta.food;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Loads foods/builtin.json into the catalog on startup (insert or update by key), so the list lives in git. */
@Component
public class BuiltinFoodSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BuiltinFoodSeeder.class);

    record Item(String key, String ru, String en, double kcal, double p, double f, double c,
                Double fiber, Double sugar, List<Serving> servings) {}

    private final FoodRepository foods;
    private final ObjectMapper json;
    private final Clock clock;

    public BuiltinFoodSeeder(FoodRepository foods, ObjectMapper json, Clock clock) {
        this.foods = foods;
        this.json = json;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        List<Item> items;
        try (InputStream in = new ClassPathResource("foods/builtin.json").getInputStream()) {
            items = json.readValue(in, new TypeReference<>() {});
        }
        Instant now = Instant.now(clock);
        for (Item i : items) {
            Food f = foods.findBySourceAndExternalId(Food.Source.BUILTIN, i.key())
                    .orElseGet(() -> new Food(UUID.randomUUID(), Food.Source.BUILTIN, i.key(), null, now));
            f.describe(i.ru(), i.en(), null, null);
            f.setNutrition(bd(i.kcal()), bd(i.p()), bd(i.f()), bd(i.c()),
                    i.fiber() == null ? null : bd(i.fiber()), i.sugar() == null ? null : bd(i.sugar()));
            f.setServingsJson(json.writeValueAsString(i.servings()));
            foods.save(f);
        }
        log.info("Food catalog: {} built-in foods", items.size());
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }
}
