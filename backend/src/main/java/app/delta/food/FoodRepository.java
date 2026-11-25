package app.delta.food;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FoodRepository extends JpaRepository<Food, UUID> {

    Optional<Food> findBySourceAndExternalId(Food.Source source, String externalId);

    /** Name/brand match among public foods and the user's own. 'ё' is folded to 'е' on both sides. */
    @Query("""
            select f from Food f
            where (f.ownerId is null or f.ownerId = :userId)
              and (replace(lower(f.nameRu), 'ё', 'е') like :q
                   or lower(f.nameEn) like :q
                   or lower(coalesce(f.brand, '')) like :q)
            """)
    List<Food> search(@Param("userId") UUID userId, @Param("q") String likePattern, Pageable page);

    @Query("select f from Food f where f.barcode = :barcode and (f.ownerId is null or f.ownerId = :userId)")
    List<Food> findByBarcode(@Param("userId") UUID userId, @Param("barcode") String barcode);

    List<Food> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
}
