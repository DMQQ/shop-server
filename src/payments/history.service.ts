import { Injectable } from "@nestjs/common";
import { InjectConnection, InjectRepository } from "@nestjs/typeorm";
import { ProductsEntity } from "../products/Entities/products.entity";
import { Connection, In, Repository } from "typeorm";
import { HistoryEntity } from "./history.entity";
import { Stripe } from "stripe";
import { PurchaseProps } from "./history.interface";
import { PaymentEntity, PaymentSteps } from "./payment.entity";
import { randomUUID } from "crypto";
import { CartEntity } from "../cart/cart.entity";

@Injectable()
export class HistoryService {
  private stripe: Stripe;
  constructor(
    @InjectRepository(HistoryEntity)
    private historyRepository: Repository<HistoryEntity>,

    @InjectRepository(PaymentEntity) private paymentRepository: Repository<PaymentEntity>,

    @InjectConnection() private conn: Connection,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_TEST_SECRET!, {
      apiVersion: "2020-08-27",
      typescript: true,
    });
  }

  createIntent<T extends {} = {}>(total: number, metadata?: T) {
    return this.stripe.paymentIntents.create({
      amount: total * 100,
      currency: "usd",
      metadata,
    });
  }

  constructEventPayload(sig: string, payload: Buffer) {
    const webhookSec = process.env.STRIPE_WEBHOOK_KEY;

    if (typeof webhookSec === "undefined") throw new Error("Missing webhook secret");

    return this.stripe.webhooks.constructEvent(payload, sig, webhookSec);
  }

  getHistoryGQL(user_id: number, skip = 0) {
    return this.paymentRepository.find({
      where: { user_id },
      order: { date: "DESC" },
      relations: ["products", "products.prod_id", "products.prod_id.img_id"],
      skip,
      take: 5,
    });
  }

  hasPurchased(user_id: number, prod_id: number) {
    return this.paymentRepository
      .createQueryBuilder("pt")
      .leftJoinAndSelect("pt.products", "prods")
      .where("pt.user_id = :user_id", { user_id })
      .andWhere("prods.prod_id = :prod_id", { prod_id })
      .getOneOrFail();
  }

  async purchase(props: PurchaseProps, callback?: () => Promise<void>): Promise<void> {
    const runner = this.conn.createQueryRunner();

    // await runner.connect();

    await runner.startTransaction();

    console.log("start transaction");

    try {
      await runner.manager.delete(CartEntity, { user_id: props.user_id });

      const payment_id = randomUUID();

      console.log("Payment ID: " + payment_id);

      await runner.manager.insert(PaymentEntity, {
        client_secret: props.client_secret,
        payment_id,
        payment_method: props.payment_method,
        status: PaymentSteps.finished,
        user_id: props.user_id,
        total_price: props.total_price / 100,
      });

      await runner.manager.insert(
        HistoryEntity,
        props.products.map((prod_id) => ({ prod_id, payment_id })),
      );

      await runner.manager.update(
        ProductsEntity,
        {
          prod_id: In(props.products),
        },
        { quantity: () => "quantity - 1" },
      );

      await callback?.();

      console.log("end transaction");

      await runner.commitTransaction();
    } catch (error) {
      // TODO: if transaction failed, retry,refund or inform user
      console.warn(error);
      await runner.rollbackTransaction();
    } finally {
      await runner.release();
    }
  }
}
