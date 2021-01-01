import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/edit-restaurant.dto';
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
}
