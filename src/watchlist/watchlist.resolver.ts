import { Args, Field, Int, Mutation, ObjectType, Query, Resolver } from "@nestjs/graphql";
import User from "../utils/decorators/User";
import { WatchlistEntity } from "./watchlist.entity";
import { WatchlistService } from "./watchlist.service";
import { BadRequestException } from "@nestjs/common";

@ObjectType()
class WatchlistRemoveType {
  @Field(() => Int)
  affected: number;

  @Field(() => Int)
  watchlist_id: number;
}

@ObjectType()
class WatchlistCheck {
  @Field(() => Int)
  prod_id: number;

  @Field(() => Boolean)
  isIn: boolean;
}

@Resolver(() => WatchlistEntity)
export class WatchlistResolver {
  constructor(private watchlistService: WatchlistService) {}

  @Query(() => [WatchlistEntity], { defaultValue: [] })
  async getWatchlist(
    @Args("skip", { nullable: true, type: () => Int }) skip: number,
    @User() id: number,
  ) {
    const data = await this.watchlistService.getWatchlist(id, skip);

    return data;
  }

  @Query(() => WatchlistCheck)
  async watchlistCheck(@Args("prod_id", { type: () => Int }) prod_id: number, @User() id: number) {
    const result = await this.watchlistService.checkIfProdIsIn(id, prod_id);

    return {
      prod_id,
      isIn: typeof result === "undefined",
    };
  }

  @Mutation(() => WatchlistRemoveType)
  async removeWatchlist(@Args("watchlist_id", { type: () => Int }) watchlist_id: number) {
    const { affected } = await this.watchlistService.removeById(watchlist_id);

    return {
      affected,
      watchlist_id,
    };
  }

  @Mutation(() => WatchlistEntity)
  async appendWatchlist(
    @Args("prod_id", { nullable: false, type: () => Int }) prod_id: number,
    @User() id: number,
  ) {
    try {
      const { generatedMaps } = await this.watchlistService.addWatchlistProduct(id, prod_id);

      if (generatedMaps.length < 1) throw new BadRequestException();

      return await this.watchlistService.getOne(generatedMaps[0].id);
    } catch (error) {
      throw new BadRequestException({
        message: "Something went wrong",
        statusCode: 400,
      });
    }
  }
}