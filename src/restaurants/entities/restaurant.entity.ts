import { ObjectType, Field } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity()
export class Restaurant {
  @Field(type => Number)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(type => String)
  @Column()
  name: string;

  @Field(type => Boolean)
  @Column()
  isVegan: boolean;

  @Field(type => String)
  @Column()
  address: string;

  @Field(type => String)
  @Column()
  ownersName: string;

  @Field(type => String)
  @Column()
  categoryName: string;
}
