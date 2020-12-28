import { Field } from '@nestjs/graphql';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export class CoreEntity {
  @Field(type => Number)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(type => Date)
  @CreateDateColumn()
  created_at: Date;

  @Field(type => Date)
  @UpdateDateColumn()
  updated_at: Date;
}
