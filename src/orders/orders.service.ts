import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
  ) {}

  async createOrder(
    customer: User,
    { restaurantId, items }: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);

      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }

      let orderFinalPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const item of items) {
        const { dishId, options } = item;
        const dish = await this.dishes.findOne(dishId);

        if (!dish) {
          return { success: false, error: 'Dish Not Found' };
        }

        let dishFinalPrice = dish.price;

        for (const itemOption of options) {
          const dishOption = dish.options.find(
            option => option.name === itemOption.name,
          );
          if (dishOption?.extra) {
            dishFinalPrice += dishOption.extra;
          }
          if (dishOption?.choices) {
            const dishOptionChioce = dishOption.choices.find(
              optionChoice => optionChoice.name === itemOption.choice,
            );
            if (dishOptionChioce?.extra) {
              dishFinalPrice += dishOptionChioce.extra;
            }
          }
        }
        orderFinalPrice += dishFinalPrice;
        const orderItem = await this.orderItems.save(
          this.orderItems.create({ dish, options }),
        );
        orderItems.push(orderItem);
      }

      await this.orders.save(
        this.orders.create({
          customer,
          restaurant,
          total: orderFinalPrice,
          items: orderItems,
        }),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not create an order' };
    }
  }

  async getOrders(
    user: User,
    { status }: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    try {
      let orders: Order[] = [];
      if (user.role === UserRole.Client) {
        orders = await this.orders.find({
          where: { customer: user, ...(status && { status }) },
        });
      } else if (user.role === UserRole.Delivery) {
        orders = await this.orders.find({
          where: { driver: user, ...(status && { status }) },
        });
      } else if (user.role === UserRole.Owner) {
        const restaurants = await this.restaurants.find({
          where: { owner: user },
          relations: ['orders'],
        });
        orders = restaurants.map(restaurant => restaurant.orders).flat(1);
        if (status) {
          orders = orders.filter(order => order.status === status);
        }
      }
      return { success: true, orders };
    } catch (error) {
      return { success: false, error: 'Could not load orders' };
    }
  }
}
