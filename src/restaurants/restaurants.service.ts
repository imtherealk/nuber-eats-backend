import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { AllCategoriesOutput } from './dtos/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dtos/category.dto';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/edit-restaurant.dto';
import { RestaurantsInput, RestaurantsOutput } from './dtos/restaurants.dto';
import { Category } from './entities/category.entity';
import { Restaurant } from './entities/restaurant.entity';
import { CategoryRepository } from './repositories/category.repository';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly categories: CategoryRepository,
  ) {}

  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateRestaurantOutput> {
    try {
      const newRestaurant: Restaurant = this.restaurants.create({
        ...createRestaurantInput,
        owner,
      });
      const category = await this.categories.getOrCreate(
        createRestaurantInput.categoryName,
      );
      newRestaurant.category = category;
      await this.restaurants.save(newRestaurant);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't create a restaurant" };
    }
  }

  async editRestaurant(
    owner: User,
    editRestaurantInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    const { categoryName, restaurantId } = editRestaurantInput;

    try {
      const restaurant: Restaurant = await this.restaurants.findOne(
        restaurantId,
        { loadRelationIds: true },
      );
      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }
      if (owner.id !== restaurant.ownerId) {
        return { success: false, error: 'It is not your restaurant' };
      }

      let category: Category = null;
      if (categoryName) {
        category = await this.categories.getOrCreate(categoryName);
      }
      await this.restaurants.save([
        {
          id: restaurantId,
          ...editRestaurantInput,
          ...(category && { category }),
        },
      ]);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't edit this restaurant" };
    }
  }

  async deleteRestaurant(
    owner: User,
    { restaurantId }: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    try {
      const restaurant: Restaurant = await this.restaurants.findOne(
        restaurantId,
        { loadRelationIds: true },
      );
      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }
      if (owner.id !== restaurant.ownerId) {
        return { success: false, error: 'It is not your restaurant' };
      }

      await this.restaurants.delete(restaurantId);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't delete this restaurant" };
    }
  }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.categories.find();
      return { success: true, categories: categories };
    } catch (error) {
      return { success: false, error: 'Could not find categories' };
    }
  }

  async countRestaurants(category: Category): Promise<number> {
    return await this.restaurants.count({ category });
  }
  async findCategoryBySlug({
    slug,
    page,
  }: CategoryInput): Promise<CategoryOutput> {
    try {
      const category = await this.categories.findOne({ slug });
      if (!category) {
        return { success: false, error: 'Category Not Found' };
      }
      const restaurants = await this.restaurants.find({
        where: { category },
        take: 25,
        skip: (page - 1) * 25,
      });
      const totalResults = await this.countRestaurants(category);

      return {
        success: true,
        results: category,
        restaurants,
        totalPages: Math.ceil(totalResults / 25),
        totalResults,
      };
    } catch (error) {
      return { success: false, error: 'Could not load this category' };
    }
  }

  async allRestaurants({ page }: RestaurantsInput): Promise<RestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        skip: (page - 1) * 25,
        take: 25,
      });
      return {
        success: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / 25),
        totalResults,
      };
    } catch (error) {
      return { success: false, error: 'Could not load restaurants' };
    }
  }
}
