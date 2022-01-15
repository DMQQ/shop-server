import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { HistoryDto } from "./dto/history.dto";
import { HistoryService } from "./history.service";
import { Response } from "express";
import { CartService } from "src/cart/cart.service";
import { NotificationsService } from "src/notifications/notifications.service";
import { expo } from "src/notifications/methods";
import User from "src/decorators/User";
import Stripe from "stripe";

@Controller("payments")
export class HistoryController {
  private stripe: Stripe;
  constructor(
    private historyService: HistoryService,
    private cartService: CartService,
    private notifyService: NotificationsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_TEST_SECRET, {
      apiVersion: "2020-08-27",
      typescript: true,
    });
  }

  @Get("/history")
  async getYourPurchaseHistory(@User() id: number, @Res() response: Response) {
    return this.historyService.getHistory(id).then(([result, ammount]) => {
      return response.send({
        hasMore: false,
        results: result.map((prod: any) => ({
          product: {
            ...prod.prod_id,
            img_id: prod.img_id,
            history_id: prod.history_id,
            date: prod.date,
            status: prod.status,
          },
          details: {
            purchase_id: prod.history_id,
            date: prod.date,
            status: prod.status,
          },
        })),
      });
    });
  }

  @Post("/create-payment-intent")
  async createPayment(
    @Body() { prod_id }: HistoryDto,
    @Res() response: Response,
  ) {
    try {
      const total = await this.historyService.getTotalPriceOfSelectedProducts(
        prod_id,
      );

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: total * 100,
        currency: "usd",
      });

      response.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {}
  }

  @Post("/purchase")
  createPurchaseHistory(
    @Body() { prod_id }: HistoryDto,
    @User() user_id: number,
    @Res() res: Response,
  ) {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const fullTime = `${year}.${month}.${day}`;

    this.historyService
      .addHistory(prod_id, { user_id, date: fullTime })
      .then(async (result) => {
        if (result === "finished") {
          try {
            await this.cartService.removeAllRelatedToUser(user_id);

            this.notifyService.getUserToken(user_id).then(async ({ token }) => {
              await expo.sendPushNotificationsAsync([
                {
                  to: token,
                  sound: "default",
                  body: "❤ Purchase copy can be found in your mail box ❤",
                  title: "❤ Thank you for purchase ❤",
                },
              ]);
            });
          } catch (error) {
            res.status(HttpStatus.BAD_REQUEST).send({
              message: "Request Failed, try again",
              code: HttpStatus.BAD_REQUEST,
            });
          }
          return res
            .status(HttpStatus.CREATED)
            .send({ message: "Success", code: HttpStatus.CREATED });
        }
        res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: "Failed", code: HttpStatus.BAD_REQUEST });
      });
  }
}
