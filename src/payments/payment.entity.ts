import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { HistoryEntity } from "./history.entity";

export enum PaymentSteps {
  created = "created",
  processing = "processing",
  finished = "finished",
  failed = "failed",
}

@ObjectType()
@Entity("payment")
export class PaymentEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  payment_id: string;

  @Column({ type: "int" })
  user_id: number;

  @Column({ type: "varchar", length: "50", select: false })
  payment_method: string;

  @Column({ type: "varchar", select: false })
  client_secret: string;

  @Field(() => Int)
  @Column({ type: "int", nullable: false })
  total_price: number;

  @Field(() => String)
  @CreateDateColumn({ insert: true, type: "timestamp" })
  date: string;

  @Field({ nullable: true })
  @Column({ type: "enum", enum: PaymentSteps, nullable: true, select: false })
  status: PaymentSteps;

  @Field(() => [HistoryEntity])
  @OneToMany(() => HistoryEntity, (type) => type.payment_id)
  products: HistoryEntity[];
}
