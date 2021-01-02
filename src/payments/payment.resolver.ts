import { Resolver } from '@nestjs/graphql';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payment.service';

@Resolver(of => Payment)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}
}
