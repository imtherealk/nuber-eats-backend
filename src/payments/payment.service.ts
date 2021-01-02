import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {
  CreatePaymentInput,
  CreatePaymentOutput,
} from './dtos/create-payment.dto';
import { GetPaymentOutput } from './dtos/get-payments.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
  ) {}

  async createPayment(
    owner: User,
    { transactionId, restaurantId }: CreatePaymentInput,
  ): Promise<CreatePaymentOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);

      if (!restaurant) {
        return { success: false, error: 'Restaurant Not Found' };
      }
      if (restaurant.ownerId !== owner.id) {
        return { success: false, error: 'Not Allowed to Access' };
      }
      await this.payments.save(
        this.payments.create({ transactionId, user: owner, restaurant }),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not create payment' };
    }
  }
  async getPayments(owner: User): Promise<GetPaymentOutput> {
    try {
      const payments = await this.payments.find({ user: owner });
      return { success: true, payments };
    } catch (error) {
      return { success: false, error: 'Could not load your payments' };
    }
  }
}
