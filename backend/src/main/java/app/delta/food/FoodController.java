package app.delta.food;

import app.delta.common.AuthInterceptor;
import app.delta.food.FoodDtos.FoodDto;
import app.delta.food.FoodDtos.NewFood;
import app.delta.food.FoodDtos.NewRecipe;
import app.delta.food.FoodDtos.RecentFood;
import app.delta.food.FoodDtos.SearchResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foods;

    public FoodController(FoodService foods) {
        this.foods = foods;
    }

    private static String lang(String lang) {
        return "en".equals(lang) ? "en" : "ru";
    }

    /** online=true also asks Open Food Facts (slower, rate-limited): call it after the user stops typing. */
    @GetMapping("/search")
    public SearchResult search(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @RequestParam String q,
                               @RequestParam(defaultValue = "ru") String lang,
                               @RequestParam(defaultValue = "false") boolean online) {
        return foods.search(userId, q, lang(lang), online);
    }

    @GetMapping("/barcode/{code}")
    public FoodDto barcode(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable String code,
                           @RequestParam(defaultValue = "ru") String lang) {
        return foods.byBarcode(userId, code, lang(lang));
    }

    @GetMapping("/recent")
    public List<RecentFood> recent(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                                   @RequestParam(defaultValue = "ru") String lang) {
        return foods.recent(userId, lang(lang));
    }

    @GetMapping("/favorites")
    public List<FoodDto> favorites(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                                   @RequestParam(defaultValue = "ru") String lang) {
        return foods.favorites(userId, lang(lang));
    }

    @GetMapping("/mine")
    public List<FoodDto> mine(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                              @RequestParam(defaultValue = "ru") String lang) {
        return foods.mine(userId, lang(lang));
    }

    @GetMapping("/{id}")
    public FoodDto get(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id,
                       @RequestParam(defaultValue = "ru") String lang) {
        return foods.get(userId, id, lang(lang));
    }

    @PutMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void favorite(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id) {
        foods.setFavorite(userId, id, true);
    }

    @DeleteMapping("/{id}/favorite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfavorite(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id) {
        foods.setFavorite(userId, id, false);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodDto create(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @Valid @RequestBody NewFood body,
                          @RequestParam(defaultValue = "ru") String lang) {
        return foods.create(userId, body, lang(lang));
    }

    @PostMapping("/recipes")
    @ResponseStatus(HttpStatus.CREATED)
    public FoodDto createRecipe(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                                @Valid @RequestBody NewRecipe body, @RequestParam(defaultValue = "ru") String lang) {
        return foods.createRecipe(userId, body, lang(lang));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id) {
        foods.delete(userId, id);
    }
}
