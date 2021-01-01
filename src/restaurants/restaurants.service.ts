import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import { Category } from './entities/category.entity';
import { Restaurant } from './entities/restaurant.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
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
      const categoryName = createRestaurantInput.categoryName
        .trim()
        .toLowerCase()
        .replace(/ +/g, ' ');
      const categorySlug = categoryName.replace(/ /g, '-');

      let category = await this.categories.findOne({ slug: categorySlug });
      if (!category) {
        category = this.categories.create({
          name: categoryName,
          slug: categorySlug,
        });
        await this.categories.save(category);
      }
      newRestaurant.category = category;
      await this.restaurants.save(newRestaurant);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Couldn't create a restaurant" };
    }
  }
}
