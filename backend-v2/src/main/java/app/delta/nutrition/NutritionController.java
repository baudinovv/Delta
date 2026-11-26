package app.delta.nutrition;

import app.delta.common.AuthInterceptor;
import app.delta.nutrition.NutritionDtos.AnalyzeRequest;
import app.delta.nutrition.NutritionDtos.Analysis;
import app.delta.nutrition.NutritionDtos.Day;
import app.delta.nutrition.NutritionDtos.Entry;
import app.delta.nutrition.NutritionDtos.NewEntries;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/nutrition")
public class NutritionController {

    private final NutritionService nutrition;
    private final FoodAnalyzer analyzer;

    public NutritionController(NutritionService nutrition, FoodAnalyzer analyzer) {
        this.nutrition = nutrition;
        this.analyzer = analyzer;
    }

    @GetMapping("/day")
    public Day day(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return nutrition.day(userId, date);
    }

    @PostMapping("/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public List<Entry> add(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                           @Valid @RequestBody NewEntries body) {
        return nutrition.add(userId, body);
    }

    @DeleteMapping("/entries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id) {
        nutrition.delete(userId, id);
    }

    /** Estimates a meal from a photo. Nothing is saved until the user confirms via POST /entries. */
    @PostMapping("/analyze")
    public Analysis analyze(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                            @Valid @RequestBody AnalyzeRequest body) {
        return analyzer.analyze(body);
    }
}
