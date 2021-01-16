import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Raw, Repository } from 'typeorm';
import { AllCategoriesOutput } from './dtos/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dtos/category.dto';
import { CreateDishInput, CreateDishOutput } from './dtos/create-dish.dto';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import { DeleteDishInput, DeleteDishOutput } from './dtos/delete-dish.dto';
import { EditDishInput, EditDishOutput } from './dtos/edit-dish.dto';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/edit-restaurant.dto';
import { RestaurantInput, RestaurantOutput } from './dtos/restaurant.dto';
import { RestaurantsInput, RestaurantsOutput } from './dtos/restaurants.dto';
import {
  SearchRestaurantInput,
  SearchRestaurantOutput,
} from './dtos/search-restaurant.dto';
import { Category } from './entities/category.entity';
import { Dish } from './entities/dish.entity';
import { Restaurant } from './entities/restaurant.entity';
import { CategoryRepository } from './repositories/category.repository';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly categories: CategoryRepository,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
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
        order: {
          isPromoted: 'DESC',
        },
      });
      const totalResults = await this.countRestaurants(category);

      return {
        success: true,
        category,
        restaurants,
        totalPages: Math.ceil(totalResults / 25),
        totalResults,
      };
    } catch (error) {
      return { success: false, error: 'Could not load this category' };
    }
  }

  async allRestaurants({ page }: RestaurantsInput): Promise<RestaurantsOutput> {
    const PAGE_SIZE = 3;
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        order: {
          isPromoted: 'DESC',
        },
      });
      return {
        success: true,
        restaurants: restaurants,
        totalPages: Math.ceil(totalResults / PAGE_SIZE),
        totalResults,
      };
    } catch (error) {
      return { success: false, error: 'Could not load restaurants' };
    }
  }
  async findRestaurantById({
    restaurantId,
  }: RestaurantInput): Promise<RestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId, {
        relations: ['category', 'menu'],
      });
      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }
      return { success: true, restaurant };
    } catch (error) {
      return { success: false, error: 'Could not find restaurant' };
    }
  }

  async searchRestaurantByName({
    query,
    page,
  }: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        // where: `"name" ILIKE '%${query}%'`,
        where: {
          name: Raw(name => `${name} ILIKE '%${query}%'`),
        },
        skip: (page - 1) * 25,
        take: 25,
      });
      return {
        success: true,
        restaurants,
        totalResults,
        totalPages: Math.ceil(totalResults / 25),
      };
    } catch (error) {
      return { success: false, error: 'Could not search restaurants' };
    }
  }

  async createDish(
    owner: User,
    createDishInput: CreateDishInput,
  ): Promise<CreateDishOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        createDishInput.restaurantId,
      );
      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }
      if (owner.id !== restaurant.ownerId) {
        return { success: false, error: 'It is not your restaurant' };
      }
      await this.dishes.save(
        this.dishes.create({ ...createDishInput, restaurant }),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not create a dish' };
    }
  }

  async editDish(
    owner: User,
    editDishInput: EditDishInput,
  ): Promise<EditDishOutput> {
    try {
      const dish = await this.dishes.findOne(editDishInput.dishId, {
        relations: ['restaurant'],
      });
      if (!dish) {
        return { success: false, error: 'Dish Not Found' };
      }
      if (owner.id !== dish.restaurant.ownerId) {
        return { success: false, error: 'It is not your restaurant' };
      }

      await this.dishes.save([
        {
          id: editDishInput.dishId,
          ...editDishInput,
        },
      ]);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not edit this dish' };
    }
  }

  async deleteDish(
    owner: User,
    { dishId }: DeleteDishInput,
  ): Promise<DeleteDishOutput> {
    try {
      const dish = await this.dishes.findOne(dishId, {
        relations: ['restaurant'],
      });
      if (!dish) {
        return { success: false, error: 'Dish Not Found' };
      }
      if (owner.id !== dish.restaurant.ownerId) {
        return { success: false, error: 'It is not your restaurant' };
      }
      await this.dishes.delete(dishId);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not delete this dish' };
    }
  }
}
