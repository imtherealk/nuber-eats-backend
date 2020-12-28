import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { RestaurantsService } from './restaurants.service';

@Resolver(of => Restaurant)
export class RestaurantsResolver {
  constructor(private readonly restaurantsService: RestaurantsService) {}
  @Query(returns => [Restaurant])
  restaurants(): Promise<Restaurant[]> {
    return this.restaurantsService.getAll();
  }

  @Mutation(returns => Boolean)
  createRestaurant(@Args() createRestaurantDto: CreateRestaurantDto): boolean {
    console.log(createRestaurantDto);
    return true;
  }
}
