import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import {
  NEW_COOKED_ORDER,
  NEW_ORDER_UPDATE,
  NEW_PENDING_ORDER,
  PUB_SUB,
} from 'src/common/common.constants';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { EditOrderInput, EditOrderOutput } from './dtos/edit-order.dto';
import { GetOrderInput, GetOrderOutput } from './dtos/get-order.dto';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(Dish) private readonly dishes: Repository<Dish>,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
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

      const order = await this.orders.save(
        this.orders.create({
          customer,
          restaurant,
          total: orderFinalPrice,
          items: orderItems,
        }),
      );
      await this.pubSub.publish(NEW_PENDING_ORDER, {
        pendingOrders: { order, ownerId: restaurant.ownerId },
      });
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

  canSeeOrder(user: User, order: Order): boolean {
    let allowed = false;
    if (user.role === UserRole.Client && order.customerId === user.id) {
      allowed = true;
    }
    if (user.role === UserRole.Delivery && order.driverId === user.id) {
      allowed = true;
    }
    if (user.role === UserRole.Owner && order.restaurant.ownerId === user.id) {
      allowed = true;
    }
    return allowed;
  }

  async getOrder(user: User, { id }: GetOrderInput): Promise<GetOrderOutput> {
    try {
      const order = await this.orders.findOne(id, {
        relations: ['restaurant', 'items'],
      });
      if (!order) {
        return { success: false, error: 'Order Not Found' };
      }

      if (!this.canSeeOrder(user, order)) {
        return { success: false, error: 'Order Not Allowed to Access' };
      }

      return { success: true, order };
    } catch (error) {
      return { success: false, error: 'Could not load the order' };
    }
  }

  async editOrder(
    user: User,
    { id, status }: EditOrderInput,
  ): Promise<EditOrderOutput> {
    try {
      const order = await this.orders.findOne(id);

      if (!order) {
        return { success: false, error: 'Order Not Found' };
      }

      if (!this.canSeeOrder(user, order)) {
        return { success: false, error: 'Order Not Allowed to Access' };
      }
      let canEdit = false;

      if (user.role === UserRole.Client) {
        if (
          order.status === OrderStatus.Pending &&
          status === OrderStatus.Cancelled
        ) {
          canEdit = true;
        }
      }
      if (user.role === UserRole.Owner) {
        if (
          status === OrderStatus.Cancelled ||
          status === OrderStatus.Cooking ||
          status === OrderStatus.Cooked
        ) {
          canEdit = true;
        }
      }
      if (user.role === UserRole.Delivery) {
        if (
          (order.status === OrderStatus.Cooked &&
            status === OrderStatus.PickedUp) ||
          (order.status === OrderStatus.PickedUp &&
            status === OrderStatus.Delivered)
        ) {
          canEdit = true;
        }
      }
      if (!canEdit) {
        return { success: false, error: 'Not allowed to update status' };
      }
      await this.orders.save({ id: order.id, status });
      const newOrder = { ...order, status };
      if (user.role === UserRole.Owner) {
        if (status === OrderStatus.Cooked) {
          await this.pubSub.publish(NEW_COOKED_ORDER, {
            cookedOrders: newOrder,
          });
        }
      }
      await this.pubSub.publish(NEW_ORDER_UPDATE, {
        orderUpdates: newOrder,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not edit the order' };
    }
  }
}
