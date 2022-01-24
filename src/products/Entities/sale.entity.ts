import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Column,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ProductsEntity } from "./products.entity";

@Entity("daily_promotion")
export class SaleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: "date", nullable: false, insert: true })
  date: Date;

  @ManyToOne(() => ProductsEntity, (type) => type.prod_id)
  @JoinColumn({ name: "prod_id" })
  prod_id: ProductsEntity;

  @Column({ type: "varchar" })
  type: string;
}
